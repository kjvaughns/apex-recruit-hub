import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchRecruiters, type RecruiterOption } from "@/lib/applications.functions";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({ r }: { r: RecruiterOption }) {
  if (r.avatar_url) {
    return <img src={r.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-apex-fog">
      {initials(r.full_name)}
    </span>
  );
}

export function RecruiterCombobox({
  value,
  onChange,
  invalid,
}: {
  value: RecruiterOption | null;
  onChange: (r: RecruiterOption | null) => void;
  invalid?: boolean;
}) {
  const search = useServerFn(searchRecruiters);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecruiterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // Debounced, race-safe server search. Runs while the popover is open.
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      search({ data: { q: query.trim() } })
        .then((rows) => {
          if (id === reqId.current) setResults(rows);
        })
        .catch(() => {
          if (id === reqId.current) setResults([]);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            "apx-input flex items-center justify-between gap-2 text-left",
            invalid && "border-red-500/60",
          )}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar r={value} />
              <span className="truncate text-apex-ivory">{value.full_name}</span>
            </span>
          ) : (
            <span className="text-apex-faint">Search for your recruiter…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-apex-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] border-white/10 bg-apex-panel p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a first or last name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-apex-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-apex-muted">
                No active agents found.
              </div>
            ) : (
              <CommandGroup>
                {results.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.id}
                    onSelect={() => {
                      onChange(r);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Avatar r={r} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-apex-ivory">{r.full_name}</span>
                      {r.team_name && (
                        <span className="truncate text-[12px] text-apex-faint">{r.team_name}</span>
                      )}
                    </span>
                    {value?.id === r.id && <Check className="ml-auto h-4 w-4 text-apex-gold" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
