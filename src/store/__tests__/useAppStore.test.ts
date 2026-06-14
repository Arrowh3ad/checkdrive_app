// ─────────────────────────────────────────────────────────────────────────────
// Tests for the Zustand store (useAppStore).
//
// The store is a singleton, so each test sets the slice of state it cares about
// via `useAppStore.setState(...)`, calls an action, then asserts on the new
// state read with `useAppStore.getState()`. No React, no device — pure logic.
// ─────────────────────────────────────────────────────────────────────────────

import { useAppStore } from '../useAppStore';
import { ActiveRun, Checklist } from '../../types';

// Minimal valid Checklist for tests; override only the fields a test cares about.
function makeChecklist(over: Partial<Checklist> = {}): Checklist {
  return {
    id: 'cl-test',
    name: 'Test',
    iconName: 'list-outline',
    iconBg: '#fff',
    iconColor: '#000',
    startItems: [],
    endItems: [],
    stops: [],
    isMultiStop: false,
    autoDetect: false,
    geofenceEnabled: false,
    endOfTripEnabled: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

// Convenience: patch settings without dropping the other required fields.
function patchSettings(patch: Partial<ReturnType<typeof useAppStore.getState>['settings']>) {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, ...patch } });
}

describe('downgradeFromPro', () => {
  it('clears isPro but never deletes the user\'s checklists', () => {
    useAppStore.setState({
      checklists: [1, 2, 3, 4, 5].map((n) => makeChecklist({ id: `c${n}` })),
    });
    patchSettings({ isPro: true, defaultChecklistId: 'c5' });

    useAppStore.getState().downgradeFromPro();

    const s = useAppStore.getState();
    // Data is preserved — only the entitlement flag flips. (We never destroy
    // checklists; the free cap only gates creating *new* ones.)
    expect(s.checklists).toHaveLength(5);
    expect(s.settings.isPro).toBe(false);
  });
});

describe('autoDetect single-select', () => {
  it('clears autoDetect on other lists when one is enabled via addChecklist', () => {
    useAppStore.setState({
      checklists: [makeChecklist({ id: 'a', autoDetect: true })],
    });

    useAppStore.getState().addChecklist(makeChecklist({ id: 'b', autoDetect: true }));

    const lists = useAppStore.getState().checklists;
    // The pre-existing list loses autoDetect; exactly one list (the new one) keeps it.
    // (addChecklist generates a fresh id, so we don't assert on 'b' specifically.)
    expect(lists.find((c) => c.id === 'a')!.autoDetect).toBe(false);
    expect(lists.filter((c) => c.autoDetect)).toHaveLength(1);
  });

  it('clears autoDetect on other lists when one is enabled via updateChecklist', () => {
    useAppStore.setState({
      checklists: [
        makeChecklist({ id: 'a', autoDetect: true }),
        makeChecklist({ id: 'b', autoDetect: false }),
      ],
    });

    useAppStore.getState().updateChecklist('b', { autoDetect: true });

    const lists = useAppStore.getState().checklists;
    expect(lists.filter((c) => c.autoDetect).map((c) => c.id)).toEqual(['b']);
  });
});

describe('addTripLog history', () => {
  it('keeps history for free users and prepends the newest', () => {
    useAppStore.setState({
      tripLogs: Array.from({ length: 10 }, (_, i) => ({
        id: `l${i}`,
        checklistId: 'c',
        checklistName: 'old',
        checkedCount: 1,
        totalCount: 1,
        timestamp: new Date().toISOString(),
        isComplete: true,
      })),
    });
    patchSettings({ isPro: false });

    useAppStore.getState().addTripLog({
      checklistId: 'c',
      checklistName: 'new',
      checkedCount: 1,
      totalCount: 1,
      timestamp: new Date().toISOString(),
      isComplete: true,
    });

    const logs = useAppStore.getState().tripLogs;
    expect(logs).toHaveLength(11); // free users are no longer capped at 10
    expect(logs[0].checklistName).toBe('new'); // newest at the front
  });
});

describe('active runs + trip tracking', () => {
  beforeEach(() => useAppStore.setState({ activeRuns: [], lastTripChecklistId: null }));

  const baseRun: ActiveRun = {
    checklistId: 'c1',
    isMultiStop: false,
    startedAt: 't',
    updatedAt: 't',
    phase: 'start',
    startDone: false,
    checked: {},
    checkedAt: {},
    stopIndex: 0,
    stopChecked: {},
    stopCheckedAt: {},
  };

  it('saveActiveRun upserts (one entry per checklist) and records the trip checklist', () => {
    useAppStore.getState().saveActiveRun(baseRun);
    expect(useAppStore.getState().activeRuns).toHaveLength(1);
    // Starting a run marks it as the current trip (used by the back-seat logic).
    expect(useAppStore.getState().lastTripChecklistId).toBe('c1');

    // Saving again for the same checklist replaces, not appends.
    useAppStore.getState().saveActiveRun({ ...baseRun, phase: 'end' });
    expect(useAppStore.getState().activeRuns).toHaveLength(1);
    expect(useAppStore.getState().activeRuns[0].phase).toBe('end');
  });
});

describe('deleteChecklist', () => {
  it('clears the deleted checklist if it was the default', () => {
    useAppStore.setState({ checklists: [makeChecklist({ id: 'c1' })] });
    patchSettings({ defaultChecklistId: 'c1' });

    useAppStore.getState().deleteChecklist('c1');

    expect(useAppStore.getState().checklists).toHaveLength(0);
    expect(useAppStore.getState().settings.defaultChecklistId).toBeNull();
  });
});
