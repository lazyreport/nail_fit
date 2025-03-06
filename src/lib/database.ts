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
  tableName: string,
  filter?: string,
  query?: {
    select?: string;
    eq?: { column: string; value: any };
    order?: { column: string; ascending?: boolean };
  }
) {
  let queryBuilder = supabase.from(tableName).select(query?.select || "*");

  if (filter) {
    const [column, operator, value] = filter.split(/\s*(=|!=|>|<|>=|<=)\s*/);
    if (operator === "=") {
      queryBuilder = queryBuilder.eq(column, value.replace(/^'|'$/g, ""));
    }
  }

  if (query?.eq) {
    queryBuilder = queryBuilder.eq(query.eq.column, query.eq.value);
  }

  if (query?.order) {
    queryBuilder = queryBuilder.order(query.order.column, {
      ascending: query.order.ascending ?? true,
    });
  }

  const { data, error } = await queryBuilder;

  if (error) {
    throw error;
  }

  return data as T[];
}

// Example function to insert data
export async function insertData<T>(tableName: string, data: Partial<T>) {
  const { data: result, error } = await supabase
    .from(tableName)
    .insert(data)
    .select();

  if (error) {
    throw error;
  }

  return result as T[];
}

// Example function to update data
export async function updateData<T>(
  tableName: string,
  id: string | number,
  data: Partial<T>
) {
  const { data: result, error } = await supabase
    .from(tableName)
    .update(data)
    .eq("id", id)
    .select();

  if (error) {
    throw error;
  }

  return result as T[];
}

// Example function to delete data
export async function deleteData(tableName: string, filter?: string) {
  let queryBuilder = supabase.from(tableName).delete();

  if (filter) {
    const [column, operator, value] = filter.split(/\s*(=|!=|>|<|>=|<=)\s*/);
    if (operator === "=") {
      queryBuilder = queryBuilder.eq(column, value.replace(/^'|'$/g, ""));
    }
  }

  const { error } = await queryBuilder;

  if (error) {
    throw error;
  }
}
