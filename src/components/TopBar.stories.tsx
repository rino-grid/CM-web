import type { Meta, StoryObj } from '@storybook/react';
import { TopBar } from './TopBar';

const meta: Meta<typeof TopBar> = {
  title: 'Layout/TopBar',
  component: TopBar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    currentPage: {
      control: 'select',
      options: ['dashboard', 'spot', 'margin', 'stake'],
    },
    onPageChange: { action: 'page changed' },
  },
};

export default meta;
type Story = StoryObj<typeof TopBar>;

export const Default: Story = {
  args: {
    currentPage: 'dashboard',
  },
  parameters: {
    docs: {
      description: {
        story: 'The default TopBar state showing the dashboard page as active.',
      },
    },
  },
};

export const SpotPage: Story = {
  args: {
    currentPage: 'spot',
  },
  parameters: {
    docs: {
      description: {
        story: 'TopBar with the Spot trading page selected.',
      },
    },
  },
};

export const MarginPage: Story = {
  args: {
    currentPage: 'margin',
  },
  parameters: {
    docs: {
      description: {
        story: 'TopBar with the Margin trading page selected.',
      },
    },
  },
};

export const StakePage: Story = {
  args: {
    currentPage: 'stake',
  },
  parameters: {
    docs: {
      description: {
        story: 'TopBar with the Staking page selected.',
      },
    },
  },
}; 