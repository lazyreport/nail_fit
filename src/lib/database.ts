import { supabase } from "./supabase";

// Function to get all tables in the database
export async function getDatabaseSchema() {
  const { error } = await supabase
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
  const { error } = await supabase.from(tableName).select("*").limit(0);

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
    limit?: number; 
    offset?: number;
    orderBy?: string;
  }
): Promise<T[]> {
  try {
    let query = supabase.from(table).select("*");

    if (condition) {
      // Split the condition to separate the ORDER BY clause if it exists
      const [filterCondition, ...orderParts] = condition.split(" ORDER BY ");
      
      // Apply the filter condition
      if (filterCondition) {
        const [column, operator, value] = filterCondition.split(/\s*(=|!=|>|<|>=|<=)\s*/);
        if (operator === "=") {
          query = query.eq(column, value.replace(/^'|'$/g, ""));
        }
      }

      // Apply ORDER BY if it was in the condition string
      if (orderParts.length > 0) {
        query = query.order(orderParts.join(" ORDER BY "));
      }
    }

    // Apply options
    if (options?.orderBy) {
      query = query.order(options.orderBy);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
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

