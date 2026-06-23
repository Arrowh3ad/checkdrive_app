// Tests for resolveIconUri - the custom-photo path resolver. The bug it fixes:
// a checklist icon saved by build N stored an absolute path under that build's
// container UUID; build N+1 has a different UUID, so the old path is dead and
// the icon renders blank. resolveIconUri rebuilds the path against the CURRENT
// documentDirectory, repairing legacy absolute paths and resolving new relative
// ones the same way.

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///CURRENT/Documents/',
}));

import { resolveIconUri, ICON_DIR } from '../icons';

describe('resolveIconUri', () => {
  it('returns undefined when there is no icon', () => {
    expect(resolveIconUri(undefined)).toBeUndefined();
  });

  it('rebuilds a relative path against the current documentDirectory', () => {
    expect(resolveIconUri(ICON_DIR + 'icon-1.jpg')).toBe(
      'file:///CURRENT/Documents/checklist-icons/icon-1.jpg'
    );
  });

  it('repairs a legacy absolute path from an old container (the blank-icon bug)', () => {
    const legacy =
      'file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/checklist-icons/icon-1.jpg';
    expect(resolveIconUri(legacy)).toBe(
      'file:///CURRENT/Documents/checklist-icons/icon-1.jpg'
    );
  });

  it('leaves a non-managed uri untouched', () => {
    expect(resolveIconUri('https://example.com/a.png')).toBe('https://example.com/a.png');
  });
});
