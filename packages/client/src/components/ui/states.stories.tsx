import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Card } from "./card";
import { EmptyState, ErrorState } from "./empty-state";
import { Loading, Skeleton } from "./skeleton";
import { Spinner } from "./spinner";

const meta = {
  title: "Feedback/Loading, empty and error",
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Shaped like the real content so nothing jumps when it arrives. The shapes fade in after 150ms. */
export const SkeletonRows: Story = {
  render: () => (
    <Loading label="Loading your worlds">
      <Card variant="inset" className="flex items-center gap-3">
        <Skeleton shape="block" className="size-11 flex-none rounded-[0.85rem]" />
        <span className="grid flex-1 gap-2">
          <Skeleton className="w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </span>
      </Card>
    </Loading>
  ),
};

export const Empty: Story = {
  render: () => (
    <Card>
      <EmptyState
        title="You are not part of any world yet."
        description="Start your own world below, or ask a game master for an invite link."
        action={<Button>Create a world</Button>}
      />
    </Card>
  ),
};

export const Failed: Story = {
  render: () => (
    <ErrorState title="We could not load this." description="Check your connection." onRetry={() => {}} retryLabel="Try again" />
  ),
};

export const Spinners: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-accent">
      <Spinner />
      <Spinner className="size-6" />
    </div>
  ),
};
