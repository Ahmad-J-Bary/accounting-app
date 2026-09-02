export interface AppCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  shortcut?: string[];
  keywords?: string[];
  group?: string;
  run: () => void | Promise<void>;
}
