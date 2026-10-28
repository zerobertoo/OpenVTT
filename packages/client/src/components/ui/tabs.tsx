import { Tabs as TabsPrimitive } from "radix-ui";
import { type ComponentProps, forwardRef } from "react";
import { cn } from "../../lib/cn";

/** Radix Tabs: tablist/tab/tabpanel roles, ids and arrow-key navigation come for free. */
export const Tabs = TabsPrimitive.Root;
export const TabContent = TabsPrimitive.Content;

/** Icon rail: a column on wide screens, a scrolling row under 52rem. */
export const TabList = forwardRef<HTMLDivElement, ComponentProps<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex flex-col gap-1.5 bg-chrome px-1.5 pt-[3.6rem] pb-2.5",
      "max-[52rem]:flex-row max-[52rem]:overflow-x-auto max-[52rem]:py-1.5 max-[52rem]:pr-[3.2rem] max-[52rem]:pl-1.5",
      className,
    )}
    {...props}
  />
));
TabList.displayName = "TabList";

export const TabTrigger = forwardRef<HTMLButtonElement, ComponentProps<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border-0 bg-transparent px-0.5 py-2 text-[0.68rem] text-on-chrome-2",
      "hover:bg-chrome-2 hover:text-on-chrome",
      "focus-visible:outline-2 focus-visible:outline-dice focus-visible:outline-offset-2",
      "data-[state=active]:bg-accent data-[state=active]:text-on-accent",
      "max-[52rem]:min-w-14 max-[52rem]:flex-1",
      className,
    )}
    {...props}
  />
));
TabTrigger.displayName = "TabTrigger";
