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
          className="w-[300px] justify-between"
        >
          {value
            ? users.find((user) => user.username === value)?.username || value
            : "Search X.com username..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command className="rounded-xl border border-white/15 bg-grok-panel/90 text-white shadow-2xl backdrop-blur-xl">
          <CommandInput
            placeholder="Type to search..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.username}
                  value={user.username}
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
                      "mr-2 h-4 w-4",
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
