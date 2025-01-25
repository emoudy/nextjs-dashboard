'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { redirect } from 'next/navigation';
/* Next.js has a client-side router cache that stores the route segments in the user's browser for a time. 
Along with prefetching, this cache ensures that users can quickly navigate between routes while reducing the 
number of requests made to the server.

The revalidatePath function clears this cache and trigger a new request to the server.  
We need this because we're updating the data displayed in the invoices route 

Once the database has been updated, the /dashboard/invoices path will be revalidated, 
and fresh data will be fetched from the server.*/
import { revalidatePath } from 'next/cache';
 
/*
  customerId - Zod throws an error if the customer field is empty and sends message if the user doesn't select a customer.
  amount - Defaults to zero if empty. The .gt() tells Zod that we always want the amount greater than 0.
  status - Zod throws an error if the status field is empty and sends a message if the user doesn't select a status.
*/
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select a customer.' }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], { invalid_type_error: 'Please select an invoice status.' }),
  date: z.string(),
});

//  Initial state of the form
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });
export async function createInvoice(prevState: State, formData: FormData) {
  /* Validate form using Zod
    safeParse() will return an object containing either a success or error field which will help handle 
    validation more gracefully without having put this logic inside the try/catch block. 
  */
  const validatedFields  = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    // If a database error occurs, return a more specific error.
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  // Revalidate the cache for the invoices page and redirect the user.
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function updateInvoice(id: string, prevState: State, formData: FormData) {
  /* Validate form using Zod
    safeParse() will return an object containing either a success or error field which will help handle 
    validation more gracefully without having put this logic inside the try/catch block.
  */
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
 
  // Insert data into the database
  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
  } catch (error) {
    // If a database error occurs, return a more specific error.
    return { message: 'Database Error: Failed to Update Invoice.' };
  }
 
  // Revalidate the cache for the invoices page and redirect the user.
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  // throw new Error('Failed to Delete Invoice');
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}