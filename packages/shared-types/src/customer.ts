export interface CustomerDto {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  phone: string;
}
