import { describe, expect, it } from 'vitest';

import { isDeleteConfirmationMatch } from './accountHelpers';

describe('isDeleteConfirmationMatch', () => {
  it('matches exact localized keywords', () => {
    expect(isDeleteConfirmationMatch('ELIMINAR', 'ELIMINAR', 'pt')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isDeleteConfirmationMatch('  löschen  ', 'LÖSCHEN', 'de')).toBe(true);
  });

  it('uses locale-aware casing for Turkish dotted i', () => {
    expect(isDeleteConfirmationMatch('sil', 'SİL', 'tr')).toBe(true);
  });

  it('rejects different keywords', () => {
    expect(isDeleteConfirmationMatch('DELETE', 'ELIMINAR', 'pt')).toBe(false);
  });
});