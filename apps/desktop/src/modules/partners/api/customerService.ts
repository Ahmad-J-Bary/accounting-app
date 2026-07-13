import { createCrudService } from '@shared/lib/createService';
import type { 
  CustomerDto, 
  CreateCustomerRequest, 
  UpdateCustomerRequest 
} from '@erp/shared-types';

export const customerService = createCrudService<CustomerDto, CreateCustomerRequest, UpdateCustomerRequest>({
  name: 'customer',
});
