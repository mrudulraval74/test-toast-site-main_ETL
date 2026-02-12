/**
 * Centralized help content for tooltips and contextual help
 * This makes it easy to update help text across the application
 */

export const helpContent = {
    // Connection Page Help
    connections: {
        databaseType: {
            title: "Database Type",
            content: "Select the type of database you're connecting to. ETL workflow supports MS SQL Server and PostgreSQL."
        },
        useConnectionString: {
            title: "Use Connection String",
            content: "Toggle between entering individual connection details or using a complete connection string. Connection strings are useful when you have a pre-configured connection URL."
        },
        instance: {
            title: "Instance Name",
            content: "SQL Server instance name (e.g., SQLEXPRESS). Leave empty for the default instance. Only applicable for SQL Server connections."
        },
        trustedConnection: {
            title: "Trusted Connection (Windows Auth)",
            content: "Use Windows Authentication instead of SQL Server authentication. When enabled, the connection will use your Windows credentials instead of a username and password."
        },
        initialDatabase: {
            title: "Initial Database",
            content: "The default database to connect to. If left empty, the connection will use the server's default database."
        },
        ssl: {
            title: "SSL/TLS Encryption",
            content: "Enable encrypted connections for enhanced security. Recommended for production databases and remote connections."
        },
        testConnection: {
            title: "Test Connection",
            content: "Verify that your connection settings are correct before saving. This ensures the database is reachable and credentials are valid."
        },
        fetchDatabases: {
            title: "Fetch Databases",
            content: "Retrieve the list of databases and their structure from this connection. Useful for browsing available tables and columns."
        },
        connectionString: {
            title: "Connection String",
            content: "A complete connection URL containing all necessary information. Format varies by database type.",
            examples: {
                mssql: "Server=localhost;Database=mydb;User Id=sa;Password=...",
                postgresql: "postgresql://user:password@localhost:5432/database"
            }
        }
    },

    // Query Builder Help
    queryBuilder: {
        visualBuilder: {
            title: "Visual Query Builder",
            content: "Build SQL queries without writing code. Select tables, columns, and conditions using a visual interface. Great for users not familiar with SQL syntax."
        },
        formatQuery: {
            title: "Format SQL",
            content: "Automatically format your SQL query for better readability. Adds proper indentation and line breaks."
        },
        runPreview: {
            title: "Run Preview",
            content: "Execute your query and see the first 100 rows of results. This helps verify your query works correctly before saving or using it in comparisons."
        },
        saveQuery: {
            title: "Save Query",
            content: "Save this query for reuse in comparisons. You can organize queries in folders and give them descriptive names."
        },
        queryName: {
            title: "Query Name",
            content: "A descriptive name for this query. Use names that clearly indicate what data the query retrieves (e.g., 'Customer Orders - Production', 'User Accounts - Test')."
        },
        folder: {
            title: "Folder",
            content: "Organize your queries into folders by project, database, or purpose. Create new folders using the folder icon."
        }
    },

    // Compare Page Help
    compare: {
        queryMode: {
            title: "Query Mode",
            content: "Choose between using a saved query or writing a custom query. Saved queries are pre-tested and reusable. Custom queries allow ad-hoc comparisons."
        },
        keyMapping: {
            title: "Key Mapping",
            content: "Select columns that uniquely identify each row. These are used to match rows between source and target. Common examples: ID, Email, OrderNumber, or a combination of columns.\n\nExample: If comparing customer records, use CustomerID as the key. For orders, use OrderID."
        },
        columnMapping: {
            title: "Column Mapping",
            content: "Map which columns to compare between source and target. Columns don't need to have the same name, but should contain comparable data.\n\nExample: Map 'first_name' from source to 'FirstName' in target, or 'total_amount' to 'TotalPrice'."
        },
        compareMode: {
            title: "Compare Mode",
            content: "Full Comparison: Compares all rows in both datasets. Use for complete validation.\n\nSample Comparison: Compares a random sample of rows. Faster for large datasets, useful for quick checks."
        },
        chunkSize: {
            title: "Chunk Size",
            content: "Number of rows processed at once during comparison.\n\n• Smaller chunks (500-1000): Slower but uses less memory\n• Larger chunks (2000-5000): Faster but uses more memory\n• Recommended: 1000 for most cases"
        },
        numericTolerance: {
            title: "Numeric Tolerance",
            content: "Acceptable difference for numeric comparisons. Use this when comparing decimal values that might have small rounding differences.\n\nExample: 0.001 means values within 0.001 of each other are considered equal."
        },
        sampleSize: {
            title: "Sample Size",
            content: "Number of rows to include in sample comparison. Larger samples give more confidence but take longer.\n\nRecommended: 100-1000 rows depending on dataset size."
        },
        runPreview: {
            title: "Run Preview Required",
            content: "You must run previews for both source and target queries before comparing. This validates the queries work and provides column information for mapping."
        }
    },

    // Reports Page Help
    reports: {
        expandReport: {
            title: "Expand Report",
            content: "Click to view detailed comparison results including summary statistics, column-level mismatches, and row-by-row differences."
        },
        exportOptions: {
            title: "Export Options",
            content: "Export comparison results in various formats (JSON, CSV) for sharing or further analysis."
        },
        deleteReport: {
            title: "Delete Report",
            content: "Permanently remove this comparison report. This action cannot be undone."
        },
        clearAll: {
            title: "Clear All Reports",
            content: "Delete all saved comparison reports. Use with caution - this action cannot be undone."
        }
    },

    // General Help
    general: {
        requiredField: {
            title: "Required Field",
            content: "This field must be filled in before you can proceed."
        },
        optionalField: {
            title: "Optional Field",
            content: "This field is optional and can be left empty."
        }
    }
};

/**
 * Get help content by path
 * @param path - Dot-notation path to help content (e.g., 'connections.databaseType')
 */
export function getHelpContent(path: string): { title?: string; content: string } {
    const keys = path.split('.');
    let content: any = helpContent;

    for (const key of keys) {
        content = content?.[key];
        if (!content) {
            return { content: 'Help content not available.' };
        }
    }

    return content;
}
