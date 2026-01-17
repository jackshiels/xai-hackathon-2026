"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"

import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Check } from "lucide-react"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-lg border border-white/15 bg-black/30 px-4 text-sm font-semibold text-white shadow-inner outline-none transition focus:border-white/40 focus:bg-black/40 focus:ring-0",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-80" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-xl border border-white/10 bg-grok-panel/95 text-white shadow-xl backdrop-blur-md",
        position === "popper" && "translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-2">
        <ChevronUp className="h-4 w-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-2">
        <ChevronDown className="h-4 w-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "flex w-full cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:bg-white/10 focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemIndicator className="flex h-4 w-4 items-center justify-center text-emerald-300">
      <Check className="h-4 w-4" />
    </SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem }
