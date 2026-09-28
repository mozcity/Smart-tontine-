import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TontineCard } from './Cards';

describe('TontineCard', () => {
  it('présente une tontine de bien publique avec la marque du partenaire et le lien d’invitation', () => {
    render(
      <MemoryRouter>
        <TontineCard t={{ id: 't1', name: 'Tontine moto', kind: 'bien', contribution_amount: 45_475, frequency: 'monthly', max_members: 10, members: 3,
          good_label: 'Moto Sanili 125', good_price: 450_000, partner: { id: 'p1', name: 'Ets Sawadogo Motos', logo: null, color: '#C0392B' } }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Tontine moto')).toBeTruthy();
    expect(screen.getByText('7 places')).toBeTruthy();
    expect(screen.getByText('Ets Sawadogo Motos')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/rejoindre/t1');
  });
});
