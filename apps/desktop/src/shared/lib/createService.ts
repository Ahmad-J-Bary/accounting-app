import { invoke } from './invoke';

type ServiceActions = 'create' | 'list' | 'get' | 'update' | 'delete';

interface CrudServiceConfig<CreateReq, UpdateReq> {
  name: string;
  pluralName?: string;
  createTransform?: (data: CreateReq) => unknown;
  updateTransform?: (data: UpdateReq) => unknown;
  commands?: Partial<Record<ServiceActions, string>>;
}

const defaultCmd = (action: ServiceActions, name: string, pluralName: string) => {
  const entity = action === 'list' ? pluralName : name;
  return `${action}_${entity}`;
};

export function createCrudService<T, CreateReq = unknown, UpdateReq = unknown>(
  config: CrudServiceConfig<CreateReq, UpdateReq>
) {
  const { name, pluralName = `${name}s`, createTransform, updateTransform, commands = {} } = config;

  const cmd = (action: ServiceActions) => commands[action] ?? defaultCmd(action, name, pluralName);

  return {
    create: async (data: CreateReq): Promise<T> => {
      const payload = createTransform ? createTransform(data) : data;
      return invoke<T>(cmd('create'), { request: payload });
    },
    list: async (): Promise<T[]> => {
      return invoke<T[]>(cmd('list'));
    },
    get: async (id: string): Promise<T | null> => {
      return invoke<T | null>(cmd('get'), { id });
    },
    update: async (data: UpdateReq): Promise<T> => {
      const payload = updateTransform ? updateTransform(data) : data;
      return invoke<T>(cmd('update'), { request: payload });
    },
    delete: async (id: string): Promise<void> => {
      return invoke<void>(cmd('delete'), { id });
    },
  };
}
