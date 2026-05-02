import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface PartnerComboboxProps {
  options: { id: string; name: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PartnerCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'اختر أو اكتب اسماً جديداً...',
  searchPlaceholder = 'ابحث عن اسم...',
  className,
  disabled = false,
}: PartnerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  // Synchronize internal input value with external value
  React.useEffect(() => {
    const found = options.find(opt => opt.id === value);
    if (found) {
        setInputValue(found.name);
    } else {
        setInputValue(value || '');
    }
  }, [value, options]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    onValueChange(val); // Immediately update as name
    if (val.length > 0) setOpen(true);
    else setOpen(false);
  };

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className={cn("relative w-full", className)}>
        <div className="relative">
            <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => inputValue.length > 0 && setOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full pr-10 text-right font-bold focus-visible:ring-blue-500 border-blue-200"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Plus className="h-4 w-4 text-blue-500 opacity-50" />
            </div>
        </div>

        {open && filteredOptions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredOptions.map(option => (
                    <div
                        key={option.id}
                        className="px-4 py-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between border-b last:border-0"
                        onClick={() => {
                            onValueChange(option.id);
                            setInputValue(option.name);
                            setOpen(false);
                        }}
                    >
                        <span className="font-medium">{option.name}</span>
                        {value === option.id && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                ))}
            </div>
        )}
        
        {open && inputValue && !options.find(o => o.name === inputValue) && (
            <div className="absolute z-50 w-full mt-1 bg-blue-50 border border-blue-200 rounded-md shadow-lg p-2 text-blue-700 text-sm font-bold animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center">
                    <Plus className="w-4 h-4 ml-2" />
                    سيتم إنشاء "{inputValue}" كحساب جديد عند الحفظ
                </div>
            </div>
        )}
    </div>
  );
}
