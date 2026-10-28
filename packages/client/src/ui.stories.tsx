import type { Meta, StoryObj } from "@storybook/react-vite";
import { ApiError } from "./api";
import { ErrorMessage } from "./ui";

const meta = {
  title: "Feedback/ErrorMessage",
  component: ErrorMessage,
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A server error code is translated and announced to screen readers (`role="alert"`). */
export const KnownError: Story = { args: { error: new ApiError("invalid_credentials") } };

/** Anything unexpected falls back to the generic message. */
export const UnknownError: Story = { args: { error: new Error("boom") } };

/** Without an error nothing is rendered. */
export const NoError: Story = { args: { error: null } };
