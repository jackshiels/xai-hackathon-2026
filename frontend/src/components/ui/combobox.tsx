"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface User {
  username: string;
  display_name: string;
}

interface ComboboxProps {
  onSelect?: (username: string) => void;
}

export function Combobox({ onSelect }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [inputValue, setInputValue] = React.useState("")
  const [users, setUsers] = React.useState<User[]>([])

  React.useEffect(() => {
    if (inputValue.length > 2) {
      fetch(`${'http://localhost:8001'}/search?query=${encodeURIComponent(inputValue)}`)
        .then(res => res.json())
        .then(data => setUsers(data))
        .catch(err => console.error(err))
    } else {
      setUsers([])
    }
  }, [inputValue])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between rounded-xl border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10 focus:border-white/20 focus:bg-white/10"
        >
          {value
            ? users.find((user) => user.username === value)?.username || value
            : "Search X.com username..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popper-anchor-width)] border-0 bg-transparent p-0 shadow-none"
      >
        <Command className="rounded-2xl bg-white/5 text-white shadow-inner backdrop-blur">
          <CommandInput
            placeholder="Type to search..."
            className="border-0 text-white placeholder:text-gray-400"
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList className="max-h-[200px]">
            <CommandEmpty className="text-gra40y-0 py-3 px-4">No users found.</CommandEmpty>
            <CommandGroup className="p-2">
              {users.map((user) => (
                <CommandItem
                  key={user.username}
                  value={user.username}
                  className="hover:bg-white/10 data-[selected=true]:bg-white/20 px-3 py-2 rounded-xl text-white"
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue)
                    setInputValue(currentValue === value ? "" : user.username)
                    setOpen(false)
                    if (onSelect && currentValue !== value) {
                      onSelect(currentValue);
                    }
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-white",
                      value === user.username ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {user.display_name} (@{user.username})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
