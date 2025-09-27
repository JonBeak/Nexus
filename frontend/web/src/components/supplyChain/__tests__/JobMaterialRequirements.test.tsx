import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JobMaterialRequirements } from '../JobMaterialRequirements';

describe('JobMaterialRequirements', () => {
  const createProps = () => ({
    showNotification: vi.fn(),
    onAddToCart: vi.fn()
  });

  it('renders job data after loading mock content', async () => {
    const props = createProps();
    render(<JobMaterialRequirements {...props} />);

    await waitFor(() => {
      expect(screen.getByText('J-2025-001')).toBeInTheDocument();
    });

    expect(screen.getByText('Jobs Needing Materials')).toBeInTheDocument();
    const addMissingButtons = await screen.findAllByRole('button', { name: /Add Missing to Cart/i });
    expect(addMissingButtons.length).toBeGreaterThan(0);
  });

  it('adds missing materials to the cart when requested', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<JobMaterialRequirements {...props} />);

    const [addMissingButton] = await screen.findAllByRole('button', { name: /Add Missing to Cart/i });
    await user.click(addMissingButton);

    expect(props.onAddToCart).toHaveBeenCalledTimes(1);
    const [passedItems] = props.onAddToCart.mock.calls[0];
    expect(Array.isArray(passedItems)).toBe(true);
    expect(passedItems.length).toBeGreaterThan(0);
    expect(props.showNotification).toHaveBeenCalledWith(expect.stringMatching(/Would add/), 'success');
  });
});
