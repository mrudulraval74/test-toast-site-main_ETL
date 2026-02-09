/**
 * Centralized validation messages with examples and suggestions
 * Provides consistent, helpful error messages across the application
 */

export interface ValidationMessage {
    message: string;
    suggestion?: string;
    example?: string;
}

export const validationMessages = {
    // Connection validation
    connection: {
        nameRequired: {
            message: "Connection name is required.",
            suggestion: "Enter a descriptive name to identify this connection.",
            example: "Production SQL Server, Dev MySQL, Test Database"
        },
        hostRequired: {
            message: "Host is required.",
            suggestion: "Enter the server address where your database is hosted.",
            example: "localhost, 192.168.1.100, db.example.com"
        },
        portInvalid: {
            message: "Port must be a valid number.",
            suggestion: "Enter a numeric port value.",
            example: "1433 for SQL Server, 3306 for MySQL"
        },
        usernameRequired: {
            message: "Username is required.",
            suggestion: "Enter the database username. If using Windows Authentication, enable Trusted Connection instead.",
            example: "sa, root, dbuser"
        },
        connectionStringRequired: {
            message: "Connection string is required.",
            suggestion: "Enter a complete connection string with all necessary parameters.",
            example: "Server=localhost;Database=mydb;User Id=sa;Password=..."
        },
        testRequired: {
            message: "Connection test required before saving.",
            suggestion: "Click 'Test Connection' to verify your settings work correctly. This ensures the database is reachable and credentials are valid.",
            example: null
        }
    },

    // Query validation
    query: {
        nameRequired: {
            message: "Query name is required.",
            suggestion: "Enter a descriptive name that explains what data this query retrieves.",
            example: "Customer Orders, Active Users, Monthly Sales"
        },
        nameTooLong: {
            message: "Query name is too long (maximum 100 characters).",
            suggestion: "Use a shorter, more concise name.",
            example: null
        },
        sqlRequired: {
            message: "SQL query is required.",
            suggestion: "Enter a valid SQL SELECT statement or use the Visual Builder to create one.",
            example: "SELECT * FROM customers WHERE active = 1"
        },
        connectionRequired: {
            message: "Connection is required.",
            suggestion: "Select a database connection before writing your query.",
            example: null
        },
        invalidSyntax: {
            message: "SQL syntax error detected.",
            suggestion: "Check your query for syntax errors. Common issues: missing commas, unclosed quotes, invalid keywords.",
            example: null
        }
    },

    // Comparison validation
    comparison: {
        sourceQueryRequired: {
            message: "Source query is required.",
            suggestion: "Select a saved query or write a custom query for the source dataset.",
            example: null
        },
        targetQueryRequired: {
            message: "Target query is required.",
            suggestion: "Select a saved query or write a custom query for the target dataset.",
            example: null
        },
        previewRequired: {
            message: "Query previews are required before comparing.",
            suggestion: "Click 'Run Preview' for both source and target queries. This validates the queries work and provides column information for mapping.",
            example: null
        },
        keyMappingRequired: {
            message: "Key mapping is required.",
            suggestion: "Select at least one column to use as a unique identifier for matching rows between source and target.",
            example: "ID, Email, OrderNumber, or a combination like CustomerID + OrderDate"
        },
        columnMappingRequired: {
            message: "Column mapping is required.",
            suggestion: "Map at least one column to compare between source and target datasets.",
            example: "Map 'first_name' to 'FirstName', 'email' to 'EmailAddress', etc."
        },
        chunkSizeInvalid: {
            message: "Chunk size must be a positive number.",
            suggestion: "Enter a value between 100 and 10000. Recommended: 1000 for most cases.",
            example: "1000"
        },
        toleranceInvalid: {
            message: "Numeric tolerance must be a non-negative number.",
            suggestion: "Enter a small decimal value for acceptable numeric differences.",
            example: "0.001, 0.01, 0.1"
        },
        sampleSizeInvalid: {
            message: "Sample size must be a positive number.",
            suggestion: "Enter the number of rows to include in the sample comparison.",
            example: "100, 500, 1000"
        },
        sameConnection: {
            message: "Same connection selected for source and target.",
            suggestion: "This is allowed but unusual. Verify this is intentional - typically you compare data from different sources.",
            example: null
        }
    },

    // Report validation
    report: {
        nameRequired: {
            message: "Report name is required.",
            suggestion: "Enter a descriptive name to help you find this report later.",
            example: "Production vs Dev Comparison - Nov 2025"
        }
    }
};

/**
 * Get validation message by path
 */
export function getValidationMessage(path: string): ValidationMessage {
    const keys = path.split('.');
    let message: any = validationMessages;

    for (const key of keys) {
        message = message?.[key];
        if (!message) {
            return { message: 'Validation failed.' };
        }
    }

    return message;
}

/**
 * Format validation message for display
 */
export function formatValidationMessage(validation: ValidationMessage): string {
    let formatted = validation.message;

    if (validation.suggestion) {
        formatted += `\n\n💡 ${validation.suggestion}`;
    }

    if (validation.example) {
        formatted += `\n\n📝 Example: ${validation.example}`;
    }

    return formatted;
}
