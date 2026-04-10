---
phase: 02-auto-mode-ui
reviewed: 2026-04-10T12:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/components/arena/types.ts
  - src/hooks/useArenaSSE.ts
  - src/app/arena/page.tsx
  - src/components/arena/ArenaBubble.tsx
  - src/components/arena/ArenaStatusBar.tsx
  - src/components/arena/ArenaView.tsx
  - src/components/arena/ConversationStream.tsx
  - src/components/arena/GradeReport.tsx
  - src/components/arena/LevelCard.tsx
  - src/components/arena/LevelCardList.tsx
  - src/components/arena/RoleModelSelector.tsx
  - src/components/arena/RunControls.tsx
  - src/components/layout/ChatListPanel.tsx
  - src/components/ui/icon.tsx
  - src/i18n/en.ts
  - src/i18n/zh.ts
  - docs/handover/arena-auto-mode.md
  - docs/insights/arena-auto-mode.md
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Arena Auto Mode UI is a well-structured feature comprising a level selection view, SSE-based conversation streaming, and a grade report display. The code is clean, type-safe, and follows the project's existing patterns (authFetch, i18n, motion/react animations). i18n keys are complete and symmetric between en.ts and zh.ts (27 keys each).

Key concerns found: a potential data loss race condition in the SSE buffer parser, a floating Promise from an async callback, and several robustness gaps around missing error/edge-case handling. No security issues were found. No critical issues were found.

## Warnings

### WR-01: SSE buffer may drop final event if stream ends without trailing newline

**File:** `src/hooks/useArenaSSE.ts:188-189`
**Issue:** After the `while(true)` read loop exits (line 186: `if (done) break`), any remaining data in `buffer` is silently discarded. If the server sends the final SSE event without a trailing `\n`, it will never be parsed. The `run_completed` or `grade_result` event could be lost, leaving the UI in a permanent "running" state with no grade report shown.
**Fix:**
```typescript
// After the while loop exits (after line 200), process any remaining buffer:
if (buffer.trim().startsWith('data: ')) {
  try {
    const event: ArenaSSEEvent = JSON.parse(buffer.trim().slice(6));
    handleEvent(event);
  } catch {
    // Malformed final line — ignore
  }
}
```

### WR-02: Unhandled Promise from async callback passed as sync

**File:** `src/components/arena/ArenaView.tsx:23-28`
**Issue:** `handleStartRun` is an async function returning `Promise<void>`, but `RunControls.onStart` declares its type as `(params: RunParams) => void` (line 18 of RunControls.tsx). When React calls `handleStart` (line 42 of RunControls), the returned Promise is silently discarded. If `arenaSSE.startRun()` throws an unhandled rejection after the `setViewState` call on line 25, the UI will be stuck in `phase: 'running'` with `runId: ''` and no error display, because the rejection is not caught by any React error boundary.
**Fix:** Either (a) make `RunControls.onStart` explicitly accept `Promise<void>` and handle it, or (b) catch inside `handleStartRun` and transition to an error state:
```typescript
const handleStartRun = useCallback(async (params: RunParams) => {
  setShowRunControls(false);
  setViewState({ phase: 'running', runId: '', levelId: params.levelId });
  try {
    await arenaSSE.startRun(params);
  } catch {
    // startRun already sets error state internally, but guard against unexpected throws
    setViewState((prev) =>
      prev.phase === 'running' ? { phase: 'completed', runId: prev.runId, levelId: prev.levelId } : prev
    );
  }
}, [arenaSSE]);
```

### WR-03: Stop button not visible during grading phase

**File:** `src/components/arena/ArenaStatusBar.tsx:62`
**Issue:** The stop button is only rendered when `status === 'running'` (line 62). During the `grading` phase the SSE connection is still active (the server is streaming grading events), but the user has no way to cancel. If grading takes a long time (large rubric, slow model), the user is stuck waiting with no abort option.
**Fix:** Show the stop button during both `running` and `grading`:
```typescript
{(status === 'running' || status === 'grading') && (
```

### WR-04: cancelRun does not clear abort controller before setting error state

**File:** `src/hooks/useArenaSSE.ts:219-224`
**Issue:** `cancelRun` calls `abortRef.current?.abort()` then sets `abortRef.current = null`. However, the abort triggers the catch block in `startRun` (line 202-211). The catch block checks for `AbortError` and returns early (line 203-206), which is correct. But there is a subtle ordering issue: `cancelRun` sets `status` to `'error'` and `error` to `'Run cancelled'` (lines 222-223), while simultaneously the catch block in `startRun` could also attempt to set error state if the AbortError check does not match (e.g., on some browsers the DOMException name may differ). This is fragile. Additionally, a user-initiated cancel is not truly an "error" -- it is an intentional action, but the UI shows it as a failure (red badge). Consider a dedicated `'cancelled'` status.
**Fix:** The `ArenaRunUIStatus` type already does not include `'cancelled'`, and the i18n key `arena.status.cancelled` exists but is unused. Consider adding `'cancelled'` to `ArenaRunUIStatus` and using it:
```typescript
const cancelRun = useCallback(() => {
  abortRef.current?.abort();
  abortRef.current = null;
  setStatus('cancelled'); // requires adding 'cancelled' to ArenaRunUIStatus
  setError(null);
}, []);
```

### WR-05: ArenaView viewState transitions miss the grading phase

**File:** `src/components/arena/ArenaView.tsx:37-46`
**Issue:** The `useEffect` on line 37 transitions from `running` to `completed` when `arenaSSE.status` becomes `'completed'` or `'error'`. However, the `ArenaViewState` type has no `'grading'` phase -- it goes directly from `running` to `completed`. This means the `viewState.phase` remains `'running'` during the entire grading period, which is semantically misleading. More importantly, if a future developer adds UI logic conditioned on `viewState.phase === 'completed'` (e.g., showing a share button), it will not work until after `run_completed` fires, even though the grade is already available after `grade_result`. The current code works only because `ConversationStream` renders both `running` and `completed` phases identically.
**Fix:** Either add a `'grading'` phase to `ArenaViewState`, or document this intentional simplification in the type definition with a comment explaining that `running` covers both active conversation and grading.

## Info

### IN-01: Pervasive `as TranslationKey` casts

**File:** Multiple arena components (ArenaStatusBar.tsx, RunControls.tsx, GradeReport.tsx, etc.)
**Issue:** Every `t()` call uses `as TranslationKey` cast on string literals (e.g., `t('arena.status.running' as TranslationKey)`). Since these keys exist in the translation dictionaries, the cast is safe but defeats TypeScript's purpose -- if a key is renamed or removed, the compiler will not catch it. This pattern is widespread across the codebase (not introduced by this PR), but the arena files add 25+ new instances.
**Fix:** Define the arena keys directly in the `TranslationKey` type (or use a helper that infers the key type), so the compiler can verify them.

### IN-02: Unused i18n keys

**File:** `src/i18n/en.ts:1348`, `src/i18n/zh.ts:1345`
**Issue:** The keys `arena.status.cancelled` and `arena.error.connection` are defined in both language files but never referenced in any component. `arena.status.cancelled` was likely intended for WR-04 above. `arena.error.connection` has no corresponding UI rendering path.
**Fix:** Either wire these keys to actual UI code (e.g., implement the `cancelled` status as suggested in WR-04), or remove them to avoid dead translation entries.

### IN-03: LevelCard hardcoded English text

**File:** `src/components/arena/LevelCard.tsx:22`
**Issue:** The badge text `{level.maxTurns} turns` uses hardcoded English. This should use an i18n key for consistency with the rest of the component, especially since the project supports both English and Chinese.
**Fix:**
```typescript
<Badge variant="secondary" className="text-xs">
  {t('arena.status.turn' as TranslationKey)
    .replace('{current}', '0')
    .replace('{max}', String(level.maxTurns))}
</Badge>
// Or add a dedicated key like 'arena.levelCard.turns': '{count} turns' / '{count} 轮'
```

### IN-04: Suggestion list uses array index as React key

**File:** `src/components/arena/GradeReport.tsx:110`
**Issue:** `grade.suggestions.slice(0, 3).map((suggestion, i) => <Card key={i}>...)` uses the array index `i` as the key. Since the suggestions list is static after rendering (no reordering or deletion), this is functionally safe but is a common code smell. If the list were ever made interactive (e.g., dismissible suggestions), index keys would cause rendering bugs.
**Fix:** Use a derived stable key:
```typescript
<Card key={`${suggestion.referenceTurn}-${i}`} className="bg-muted/50">
```

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
