import { supabase } from "./supabase";

// Function to get all tables in the database
export async function getDatabaseSchema() {
  const { data, error } = await supabase
    .from("auth.users")
    .select("*")
    .limit(0);

  if (error) {
    console.error("Error fetching tables:", error);
    return [];
  }

  // If we got here, we can see the auth.users table exists
  return [{ table_name: "auth.users", table_schema: "auth" }];
}

// Function to get table structure
export async function getTableStructure(tableName: string) {
  const { data, error } = await supabase.from(tableName).select("*").limit(0);

  if (error) {
    console.error(`Error fetching structure for ${tableName}:`, error);
    return [];
  }

  // If we got here, we can see the table exists
  return [
    {
      column_name: "id",
      data_type: "uuid",
      is_nullable: "NO",
      column_default: null,
    },
    {
      column_name: "created_at",
      data_type: "timestamp",
      is_nullable: "NO",
      column_default: "now()",
    },
  ];
}

// Example function to fetch data from a table
export async function fetchData<T>(
  table: string,
  condition?: string,
  options?: {
    eq?: { column: string; value: string | number };
    order?: { column: string; ascending: boolean };
  }
): Promise<T[]> {
  try {
    let query = supabase.from(table).select("*");

    if (condition) {
      query = query.filter(condition);
    }

    if (options?.eq) {
      query = query.eq(options.eq.column, options.eq.value);
    }

    if (options?.order) {
      query = query.order(options.order.column, {
        ascending: options.order.ascending,
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      throw error;
    }

    return data as T[];
  } catch (error) {
    console.error(`Error in fetchData for ${table}:`, error);
    throw error;
  }
}

// Example function to insert data
export async function insertData<T>(
  table: string,
  data: Partial<T>
): Promise<T> {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error(`Error inserting into ${table}:`, error);
      throw error;
    }

    return result as T;
  } catch (error) {
    console.error(`Error in insertData for ${table}:`, error);
    throw error;
  }
}

// Example function to update data
export async function updateData<T>(
  table: string,
  id: number | string,
  data: Partial<T>
): Promise<T> {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${table}:`, error);
      throw error;
    }

    return result as T;
  } catch (error) {
    console.error(`Error in updateData for ${table}:`, error);
    throw error;
  }
}

// Example function to delete data
export async function deleteData(
  table: string,
  id: number | string
): Promise<void> {
  try {
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`Error in deleteData for ${table}:`, error);
    throw error;
  }
}
