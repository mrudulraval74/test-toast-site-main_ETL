import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DatabaseTree } from '@/components/DatabaseTree';
import { HelpTooltip } from '@/components/HelpTooltip';
import { connectionsApi, API_BASE_URL } from '@/lib/api';

import { useToast } from '@/hooks/use-toast';
import { getValidationMessage, formatValidationMessage } from '@/lib/validationMessages';
import { helpContent } from '@/lib/helpContent';
import { Loader2, Database, TestTube, Trash2, Info, AlertCircle, Pencil, Copy, CheckCircle2, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AIInput } from '@/components/AIInput';
import { useAIChat } from '@/hooks/useAIChat';
import { AIButton } from '@/components/AIButton';
import { AIResponseModal } from '@/components/AIResponseModal';

import { PostgreSQLForm } from './connections/database/PostgreSQLForm';
import { OracleForm } from './connections/database/OracleForm';
import { DatabricksForm } from './connections/database/DatabricksForm';
import { SnowflakeForm } from './connections/database/SnowflakeForm';
import { RedshiftForm } from './connections/database/RedshiftForm';
import { SQLiteForm } from './connections/database/SQLiteForm';

interface ConnectionsPanelProps {
  onConnectionSaved?: () => void;
  onConnectionDeleted?: () => void;
  initialData?: any; // Data to pre-fill the form
  agentId?: string; // Selected agent for testing
}

export function ConnectionsPanel({ onConnectionSaved, onConnectionDeleted, initialData, agentId }: ConnectionsPanelProps) {
  const { toast } = useToast();

  const [dbType, setDbType] = useState<'mssql' | 'azuresql' | 'mysql' | 'postgresql' | 'oracle' | 'databricks' | 'snowflake' | 'redshift' | 'mariadb' | 'sqlite'>('mssql');
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [databaseTree, setDatabaseTree] = useState<any[]>([]);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [savedConnections, setSavedConnections] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<any>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [fetchingStatus, setFetchingStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { sendMessage, actions } = useAIChat('connections');

  // AI State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState('');
  const [aiModalContent, setAiModalContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);

  const [mssqlData, setMssqlData] = useState({
    name: '',
    host: '',
    port: '1433',
    instance: '',
    initialDatabase: '',
    trustedConnection: false,
    username: '',
    password: '',
    ssl: false,
  });

  const [azureSqlData, setAzureSqlData] = useState({
    name: '',
    host: '',
    port: '1433',
    instance: '',
    initialDatabase: '',
    trustedConnection: false,
    username: '',
    password: '',
    ssl: true,
  });

  const [mysqlData, setMysqlData] = useState({
    name: '',
    host: '',
    port: '3306',
    database: '',
    username: '',
    password: '',
    charset: 'utf8mb4',
    ssl: false,
  });

  const [postgresData, setPostgresData] = useState({
    name: '',
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
    schema: 'public',
    ssl: false,
  });

  const [oracleData, setOracleData] = useState({
    name: '',
    host: '',
    port: '1521',
    serviceName: '',
    username: '',
    password: '',
    ssl: false,
  });

  const [databricksData, setDatabricksData] = useState({
    name: '',
    host: '',
    httpPath: '',
    token: '',
    catalog: 'hive_metastore',
    schema: 'default',
  });

  const [snowflakeData, setSnowflakeData] = useState({
    name: '',
    account: '',
    username: '',
    password: '',
    warehouse: '',
    database: '',
    schema: 'PUBLIC',
    role: '',
  });

  const [redshiftData, setRedshiftData] = useState({
    name: '',
    host: '',
    port: '5439',
    database: '',
    username: '',
    password: '',
    schema: 'public',
    ssl: true,
  });

  const [mariadbData, setMariadbData] = useState({
    name: '',
    host: '',
    port: '3306',
    database: '',
    username: '',
    password: '',
    charset: 'utf8mb4',
    ssl: false,
  });

  const [sqliteData, setSqliteData] = useState({
    name: '',
    filePath: '',
  });

  // Handle initialData changes (e.g. from AI action)
  useEffect(() => {
    if (initialData) {
      setShowNewForm(true);
      setEditingConnectionId(null);

      if (initialData.type === 'mysql') {
        setDbType('mysql');
        setMysqlData(prev => ({
          ...prev,
          name: initialData.name || prev.name,
          host: initialData.host || prev.host,
          port: initialData.port?.toString() || prev.port,
          database: initialData.database || prev.database,
          username: initialData.username || prev.username
        }));
      } else if (initialData.type === 'sqlserver' || initialData.type === 'mssql') {
        setDbType('mssql');
        setMssqlData(prev => ({
          ...prev,
          name: initialData.name || prev.name,
          host: initialData.host || prev.host,
          port: initialData.port?.toString() || prev.port,
          initialDatabase: initialData.database || prev.initialDatabase,
          username: initialData.username || prev.username
        }));
      }
    }
  }, [initialData]);

  useEffect(() => {
    loadSavedConnections();
  }, []);

  const loadSavedConnections = async () => {
    const { data, error } = await connectionsApi.list();
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    } else if (data && Array.isArray(data)) {
      setSavedConnections(data);
    }
  };

  const resetAllForms = () => {
    setMssqlData({
      name: '',
      host: '',
      port: '1433',
      instance: '',
      initialDatabase: '',
      trustedConnection: false,
      username: '',
      password: '',
      ssl: false,
    });
    setAzureSqlData({
      name: '',
      host: '',
      port: '1433',
      instance: '',
      initialDatabase: '',
      trustedConnection: false,
      username: '',
      password: '',
      ssl: true,
    });
    setMysqlData({
      name: '',
      host: '',
      port: '3306',
      database: '',
      username: '',
      password: '',
      charset: 'utf8mb4',
      ssl: false,
    });
    setPostgresData({
      name: '',
      host: '',
      port: '5432',
      database: '',
      username: '',
      password: '',
      schema: 'public',
      ssl: false,
    });
    setOracleData({
      name: '',
      host: '',
      port: '1521',
      serviceName: '',
      username: '',
      password: '',
      ssl: false,
    });
    setDatabricksData({
      name: '',
      host: '',
      httpPath: '',
      token: '',
      catalog: 'hive_metastore',
      schema: 'default',
    });
    setSnowflakeData({
      name: '',
      account: '',
      username: '',
      password: '',
      warehouse: '',
      database: '',
      schema: 'PUBLIC',
      role: '',
    });
    setRedshiftData({
      name: '',
      host: '',
      port: '5439',
      database: '',
      username: '',
      password: '',
      schema: 'public',
      ssl: true,
    });
    setMariadbData({
      name: '',
      host: '',
      port: '3306',
      database: '',
      username: '',
      password: '',
      charset: 'utf8mb4',
      ssl: false,
    });
    setSqliteData({
      name: '',
      filePath: '',
    });
    setConnectionString('');
    setTestSuccess(false);
    setTestStatus('idle');
    setTestError(null);
  };

  const handleAITroubleshoot = async (errorMessage: string) => {
    setAiAction('troubleshoot');
    setAiLoading(true);
    setAiModalOpen(true);
    setAiModalTitle('Connection Troubleshooting');
    setAiModalContent('');

    try {
      const prompt = `I am getting this error when connecting to a database:\n\n"${errorMessage}"\n\nSuggest step-by-step troubleshooting fixes.`;

      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          context: 'connections',
          history: [],
          contextData: { error: errorMessage }
        })
      });

      const data = await response.json();
      if (data.success) {
        setAiModalContent(data.response);
      } else {
        setAiModalContent('Failed to get AI response.');
      }
    } catch (error) {
      setAiModalContent('An error occurred while communicating with AI.');
    } finally {
      setAiLoading(false);
      setAiAction(null);
    }
  };

  const handleTestConnection = async () => {
    if (useConnectionString) {
      if (!connectionString.trim()) {
        const validation = getValidationMessage('connection.connectionStringRequired');
        toast({
          title: validation.message,
          description: formatValidationMessage(validation),
          variant: 'destructive',
        });
        return;
      }
      const getName = () => {
        switch (dbType) {
          case 'mssql': return mssqlData.name;
          case 'azuresql': return azureSqlData.name;
          case 'mysql': return mysqlData.name;
          case 'postgresql': return postgresData.name;
          case 'oracle': return oracleData.name;
          case 'databricks': return databricksData.name;
          case 'snowflake': return snowflakeData.name;
          case 'redshift': return redshiftData.name;
          case 'mariadb': return mariadbData.name;
          case 'sqlite': return sqliteData.name;
          default: return '';
        }
      };
      if (!getName().trim()) {
        const validation = getValidationMessage('connection.nameRequired');
        toast({
          title: validation.message,
          description: formatValidationMessage(validation),
          variant: 'destructive',
        });
        return;
      }
    } else {
      let name = '';
      switch (dbType) {
        case 'mssql': name = mssqlData.name; break;
        case 'azuresql': name = azureSqlData.name; break;
        case 'mysql': name = mysqlData.name; break;
        case 'postgresql': name = postgresData.name; break;
        case 'oracle': name = oracleData.name; break;
        case 'databricks': name = databricksData.name; break;
        case 'snowflake': name = snowflakeData.name; break;
        case 'redshift': name = redshiftData.name; break;
        case 'mariadb': name = mariadbData.name; break;
        case 'sqlite': name = sqliteData.name; break;
      }

      if (!name?.trim()) {
        const validation = getValidationMessage('connection.nameRequired');
        toast({
          title: validation.message,
          description: formatValidationMessage(validation),
          variant: 'destructive',
        });
        return;
      }

      // Special validation for specific types
      if ((dbType === 'mssql' || dbType === 'azuresql') && !mssqlData.host.trim() && !azureSqlData.host.trim()) {
        // Host validation is handled inside the payload construction or generic check? 
        // Let's keep it simple: Basic empty checks are often mostly handled by the UI 'required' * 
        // but good to have safety here. 
      }
    }

    setTesting(true);
    setTestError(null);
    setTestStatus('idle');

    if (!agentId) {
      setTesting(false);
      toast({
        title: "Agent Required",
        description: "Please select an active ETL Agent to test the connection.",
        variant: "destructive"
      });
      return;
    }

    let payload: any = { type: dbType, agentId };

    if (useConnectionString) {
      payload.connectionString = connectionString;
      const getName = () => {
        switch (dbType) {
          case 'mssql': return mssqlData.name;
          case 'azuresql': return azureSqlData.name;
          case 'mysql': return mysqlData.name;
          case 'postgresql': return postgresData.name;
          case 'oracle': return oracleData.name;
          case 'databricks': return databricksData.name;
          case 'snowflake': return snowflakeData.name;
          case 'redshift': return redshiftData.name;
          case 'mariadb': return mariadbData.name;
          case 'sqlite': return sqliteData.name;
          default: return '';
        }
      };
      payload.name = getName();
    } else {
      // Logic copied from handleSaveConnection to ensure consistency
      if (dbType === 'mssql' || dbType === 'azuresql') {
        const data = dbType === 'mssql' ? mssqlData : azureSqlData;
        payload = {
          ...payload, // Preserve agentId
          type: dbType,
          name: data.name,
          host: data.host,
          port: data.port ? parseInt(data.port, 10) : undefined,
          instance: (data.instance && data.instance.trim()) || undefined,
          database: data.initialDatabase || undefined,
          trusted: data.trustedConnection,
          username: data.username || undefined,
          password: data.password || undefined,
          ssl: data.ssl,
          encrypt: dbType === 'azuresql' ? true : data.ssl,
        };
      } else if (dbType === 'mysql') {
        payload = {
          ...payload, // Preserve agentId
          type: 'mysql',
          name: mysqlData.name,
          host: mysqlData.host,
          port: parseInt(mysqlData.port, 10),
          database: mysqlData.database || undefined,
          username: mysqlData.username || undefined,
          password: mysqlData.password || undefined,
          charset: mysqlData.charset,
          ssl: mysqlData.ssl
        };
      } else if (dbType === 'postgresql') {
        payload = {
          ...payload, // Preserve agentId
          type: 'postgresql',
          name: postgresData.name,
          host: postgresData.host,
          port: parseInt(postgresData.port, 10),
          database: postgresData.database || undefined,
          username: postgresData.username || undefined,
          password: postgresData.password || undefined,
          schema: postgresData.schema,
          ssl: postgresData.ssl
        };
      } else if (dbType === 'oracle') {
        payload = {
          ...payload, // Preserve agentId
          type: 'oracle',
          name: oracleData.name,
          host: oracleData.host,
          port: parseInt(oracleData.port, 10),
          sid: oracleData.sid || undefined,
          serviceName: oracleData.serviceName || undefined,
          username: oracleData.username || undefined,
          password: oracleData.password || undefined
        };
      } else if (dbType === 'databricks') {
        payload = {
          type: 'databricks',
          name: databricksData.name,
          host: databricksData.host,
          httpPath: databricksData.httpPath,
          token: databricksData.token,
          catalog: databricksData.catalog,
          schema: databricksData.schema
        };
      } else if (dbType === 'snowflake') {
        payload = {
          ...payload,
          type: 'snowflake',
          name: snowflakeData.name,
          account: snowflakeData.account,
          username: snowflakeData.username || undefined,
          password: snowflakeData.password || undefined,
          warehouse: snowflakeData.warehouse || undefined,
          database: snowflakeData.database || undefined,
          schema: snowflakeData.schema || undefined,
          role: snowflakeData.role || undefined
        };
      } else if (dbType === 'redshift') {
        payload = {
          ...payload,
          type: 'redshift',
          name: redshiftData.name,
          host: redshiftData.host,
          port: parseInt(redshiftData.port, 10),
          database: redshiftData.database,
          username: redshiftData.username,
          password: redshiftData.password,
          schema: redshiftData.schema,
          ssl: redshiftData.ssl
        };
      } else if (dbType === 'mariadb') {
        payload = {
          ...payload,
          type: 'mariadb',
          name: mariadbData.name,
          host: mariadbData.host,
          port: parseInt(mariadbData.port, 10),
          database: mariadbData.database,
          username: mariadbData.username,
          password: mariadbData.password,
          charset: mariadbData.charset,
          ssl: mariadbData.ssl
        };
      } else if (dbType === 'sqlite') {
        payload = {
          ...payload,
          type: 'sqlite',
          name: sqliteData.name,
          filePath: sqliteData.filePath,
          readonly: false
        };
      }
    }

    const { data, error } = await connectionsApi.test(payload) as any;

    if (error) {
      setTesting(false);
      setTestStatus('failed');
      setTestError(error);
      toast({
        title: 'Connection Failed',
        description: error,
        variant: 'destructive',
      });
      return;
    }

    // Check if it's an async job (via Agent)
    if (data && data.jobId) {
      setTestStatus('testing'); // Keep testing status
      toast({
        title: 'Test Initiated',
        description: 'Agent is verifying connection...',
      });

      const jobId = data.jobId;
      const startTime = Date.now();
      const timeout = 30000; // 30s timeout

      const pollInterval = setInterval(async () => {
        if (Date.now() - startTime > timeout) {
          clearInterval(pollInterval);
          setTesting(false);
          setTestStatus('failed');
          setTestError('Connection test timed out');
          toast({ title: 'Connection Failed', description: 'Agent did not respond in time.', variant: 'destructive' });
          return;
        }

        const { data: job, error: jobError } = await connectionsApi.getJob(jobId) as any;

        if (jobError || !job) return; // Retry on next tick

        if (job.status === 'completed') {
          clearInterval(pollInterval);
          setTesting(false);
          const result = job.result;
          if (result && result.success) {
            setTestSuccess(true);
            setTestStatus('success');
            toast({ title: 'Connection Successful', description: 'Agent verified the connection!' });
          } else {
            setTestStatus('failed');
            const errMsg = result?.error || 'Connection failed';
            setTestError(errMsg);
            toast({ title: 'Connection Failed', description: errMsg, variant: 'destructive' });
          }
        } else if (job.status === 'failed') {
          clearInterval(pollInterval);
          setTesting(false);
          setTestStatus('failed');
          const errMsg = job.error_log || 'Job failed';
          setTestError(errMsg);
          toast({ title: 'Connection Failed', description: errMsg, variant: 'destructive' });
        }
      }, 2000);
      return;
    }

    setTesting(false);

    if (data && typeof data === 'object' && 'success' in data && data.success) {
      setTestSuccess(true);
      setTestStatus('success');
      toast({
        title: 'Connection Successful',
        description: 'Connection test passed! You can now save this connection.',
      });
    } else {
      // Handle unsuccessful tests or unexpected response format
      const errorMsg = (data as any)?.error || (data as any)?.message || 'Unexpected response from server. Please try again.';
      setTestSuccess(false);
      setTestStatus('failed');
      setTestError(errorMsg);
      toast({
        title: 'Connection Test Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateConnection = (conn: any) => {
    setEditingConnectionId(null); // Create new
    setShowNewForm(true);
    setDbType(conn.type);

    if (conn.type === 'mssql' || conn.type === 'azuresql') {
      const data = {
        name: `${conn.name} - Copy`,
        host: conn.host || '',
        port: conn.port?.toString() || '1433',
        instance: conn.instance || '',
        initialDatabase: conn.database || '',
        trustedConnection: conn.trusted || false,
        username: conn.username || '',
        password: conn.password || '',
        ssl: conn.ssl || (conn.type === 'azuresql'),
      };
      if (conn.type === 'mssql') setMssqlData(data);
      else setAzureSqlData(data);
    } else {
      setMysqlData({
        name: `${conn.name} - Copy`,
        host: conn.host || '',
        port: conn.port?.toString() || '3306',
        database: conn.database || '',
        username: conn.username || '',
        password: conn.password || '',
        charset: conn.charset || 'utf8mb4',
        ssl: conn.ssl || false,
      });
    }

    setTestSuccess(true);
  };

  const handleSaveConnection = async () => {
    if (!testSuccess) {
      const validation = getValidationMessage('connection.testRequired');
      toast({
        title: validation.message,
        description: formatValidationMessage(validation),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    let payload: any = { type: dbType };

    if (useConnectionString) {
      payload.connectionString = connectionString;
      const getName = () => {
        switch (dbType) {
          case 'mssql': return mssqlData.name;
          case 'azuresql': return azureSqlData.name;
          case 'mysql': return mysqlData.name;
          case 'postgresql': return postgresData.name;
          case 'oracle': return oracleData.name;
          case 'databricks': return databricksData.name;
          case 'snowflake': return snowflakeData.name;
          case 'redshift': return redshiftData.name;
          case 'mariadb': return mariadbData.name;
          case 'sqlite': return sqliteData.name;
          default: return '';
        }
      };
      payload.name = getName();
    } else {
      if (dbType === 'mssql' || dbType === 'azuresql') {
        const data = dbType === 'mssql' ? mssqlData : azureSqlData;
        payload = {
          type: dbType,
          name: data.name,
          host: data.host,
          port: data.port ? parseInt(data.port, 10) : undefined,
          instance: (data.instance && data.instance.trim()) || null,
          database: data.initialDatabase || null,
          trusted: data.trustedConnection,
          username: data.username || null,
          password: data.password || null,
          ssl: data.ssl
        };
      } else if (dbType === 'mysql') {
        payload = {
          type: 'mysql',
          name: mysqlData.name,
          host: mysqlData.host,
          port: parseInt(mysqlData.port, 10),
          database: mysqlData.database || null,
          username: mysqlData.username || null,
          password: mysqlData.password || null,
          charset: mysqlData.charset,
          ssl: mysqlData.ssl
        };
      } else if (dbType === 'postgresql') {
        payload = {
          type: 'postgresql',
          name: postgresData.name,
          host: postgresData.host,
          port: parseInt(postgresData.port, 10),
          database: postgresData.database,
          username: postgresData.username,
          password: postgresData.password,
          schema: postgresData.schema,
          ssl: postgresData.ssl
        };
      } else if (dbType === 'oracle') {
        payload = {
          type: 'oracle',
          name: oracleData.name,
          host: oracleData.host,
          port: parseInt(oracleData.port, 10),
          serviceName: oracleData.serviceName,
          username: oracleData.username,
          password: oracleData.password
        };
      } else if (dbType === 'databricks') {
        payload = {
          type: 'databricks',
          name: databricksData.name,
          host: databricksData.host,
          httpPath: databricksData.httpPath,
          token: databricksData.token,
          catalog: databricksData.catalog,
          schema: databricksData.schema
        };
      } else if (dbType === 'snowflake') {
        payload = {
          type: 'snowflake',
          name: snowflakeData.name,
          account: snowflakeData.account,
          username: snowflakeData.username,
          password: snowflakeData.password,
          warehouse: snowflakeData.warehouse,
          database: snowflakeData.database,
          schema: snowflakeData.schema,
          role: snowflakeData.role
        };
      } else if (dbType === 'redshift') {
        payload = {
          type: 'redshift',
          name: redshiftData.name,
          host: redshiftData.host,
          port: parseInt(redshiftData.port, 10),
          database: redshiftData.database,
          username: redshiftData.username,
          password: redshiftData.password,
          schema: redshiftData.schema,
          ssl: redshiftData.ssl
        };
      } else if (dbType === 'mariadb') {
        payload = {
          type: 'mariadb',
          name: mariadbData.name,
          host: mariadbData.host,
          port: parseInt(mariadbData.port, 10),
          database: mariadbData.database,
          username: mariadbData.username,
          password: mariadbData.password,
          charset: mariadbData.charset,
          ssl: mariadbData.ssl
        };
      } else if (dbType === 'sqlite') {
        payload = {
          type: 'sqlite',
          name: sqliteData.name,
          filePath: sqliteData.filePath,
          readonly: false
        };
      }
    }

    let result;
    if (editingConnectionId) {
      result = await connectionsApi.update(editingConnectionId, payload);
    } else {
      result = await connectionsApi.save(payload);
    }

    setSaving(false);

    if (result.error) {
      toast({
        title: editingConnectionId ? 'Update Failed' : 'Save Failed',
        description: result.error,
        variant: 'destructive',
      });
    } else if (result.data && typeof result.data === 'object' && 'id' in result.data) {
      const savedConnectionId = result.data.id as string;

      toast({
        title: editingConnectionId ? 'Connection Updated' : 'Connection Saved',
        description: editingConnectionId
          ? 'Connection has been updated successfully. You can now fetch databases.'
          : 'Connection has been saved successfully. You can now fetch databases.',
      });
      loadSavedConnections();
      onConnectionSaved?.();

      // Clear old database tree data and set up for new fetch
      setDatabaseTree([]);
      setConnectionId(null);

      // Close the form and return to list view
      setShowNewForm(false);
      setEditingConnectionId(null);
      resetAllForms();
    }
  };

  const handleEditConnection = (conn: any) => {
    setEditingConnectionId(conn.id);
    setShowNewForm(true);
    setDbType(conn.type);

    if (conn.type === 'mssql') {
      setMssqlData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '1433',
        instance: conn.instance || '',
        initialDatabase: conn.database || '',
        trustedConnection: conn.trusted || false,
        username: conn.username || '',
        password: '', // Don't populate password for security
        ssl: conn.ssl || false,
      });
    } else {
      setMysqlData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '3306',
        database: conn.database || '',
        username: conn.username || '',
        password: '', // Don't populate password for security
        charset: conn.charset || 'utf8mb4',
        ssl: conn.ssl || false,
      });
    }

    setTestSuccess(true); // Allow saving when editing
  };

  const handleDeleteConnection = async () => {
    if (!connectionToDelete) return;

    const { error } = await connectionsApi.delete(connectionToDelete.id);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Connection Deleted',
        description: 'Connection has been removed.',
      });
      loadSavedConnections();
      onConnectionDeleted?.();
    }
    setDeleteDialogOpen(false);
    setConnectionToDelete(null);
  };

  const handleFetchDatabases = async (id: string) => {
    setLoadingDatabases(true);
    setMetadataError(null);
    setFetchingStatus(null);

    try {
      console.log('Fetching databases for connection:', id);
      const res = await connectionsApi.metadata(id);

      if (res.error) {
        setMetadataError(res.error);
        toast({
          title: "Fetch Failed",
          description: res.error,
          variant: "destructive",
        });
        return;
      }

      const data = res.data;

      // Handle Direct Sync Result
      if (data && data.databases) {
        setDatabaseTree(data.databases);
      } else {
        console.warn('Metadata response had no databases array:', data);
        setMetadataError("No databases found in metadata response");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to fetch databases";
      setMetadataError(msg);
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      // Only set loading to false if we're not polling
      if (!fetchingStatus) {
        setLoadingDatabases(false);
      }
    }
  };



  // Handle AI Actions
  useEffect(() => {
    if (actions.length > 0) {
      const lastAction = actions[actions.length - 1];
      if (lastAction.type === 'CREATE_CONNECTION') {
        const data = lastAction.data;

        // ENHANCEMENT: Validate AI-generated data
        const validationIssues = [];

        // Validate port number
        if (data.port && (isNaN(data.port) || data.port < 1 || data.port > 65535)) {
          validationIssues.push(`Invalid port number: ${data.port}`);
          data.port = data.type === 'mysql' ? 3306 : 1433; // Use default
        }

        // Validate required fields
        if (!data.name || !data.name.trim()) {
          validationIssues.push('Connection name is required');
        }
        if (!data.host || !data.host.trim()) {
          validationIssues.push('Host is required');
        }

        // ENHANCEMENT: Check for duplicate connection names
        const duplicateName = savedConnections.find(
          conn => conn.name.toLowerCase() === data.name?.toLowerCase()
        );
        if (duplicateName) {
          validationIssues.push(`Connection name "${data.name}" already exists`);
          data.name = `${data.name} (AI Generated)`;
        }

        // Show validation warnings if any
        if (validationIssues.length > 0) {
          toast({
            title: "Validation Warnings",
            description: validationIssues.join('\n'),
            variant: "destructive",
            duration: 8000,
          });
        }

        setShowNewForm(true);
        setEditingConnectionId(null);

        if (data.type === 'mysql') {
          setDbType('mysql');
          setMysqlData(prev => ({
            ...prev,
            name: data.name || prev.name,
            host: data.host || prev.host,
            port: data.port?.toString() || prev.port,
            database: data.database || prev.database,
            username: data.username || prev.username,
            ssl: data.ssl !== undefined ? data.ssl : prev.ssl,
            charset: data.charset || prev.charset
          }));
        } else if (data.type === 'sqlserver' || data.type === 'mssql') {
          setDbType('mssql');
          setMssqlData(prev => ({
            ...prev,
            name: data.name || prev.name,
            host: data.host || prev.host,
            port: data.port?.toString() || prev.port,
            instance: data.instance || prev.instance, // FIX: Added instance mapping
            initialDatabase: data.database || prev.initialDatabase,
            username: data.username || prev.username,
            trustedConnection: data.useWindowsAuth !== undefined ? data.useWindowsAuth : prev.trustedConnection, // FIX: Property name mapping
            ssl: data.ssl !== undefined ? data.ssl : prev.ssl
          }));
        } else if (data.type === 'azuresql') {
          setDbType('azuresql');
          setAzureSqlData(prev => ({
            ...prev,
            name: data.name || prev.name,
            host: data.host || prev.host,
            port: data.port?.toString() || prev.port,
            instance: data.instance || prev.instance,
            initialDatabase: data.database || prev.initialDatabase,
            username: data.username || prev.username,
            trustedConnection: false, // Azure SQL doesn't use Windows Auth
            ssl: true // Azure SQL enforces SSL
          }));
        }

        toast({
          title: "Form Filled",
          description: validationIssues.length > 0
            ? "Connection details pre-filled with some corrections."
            : "Connection details have been pre-filled by AI.",
        });
      } else if (lastAction.type === 'TEST_CONNECTION') {
        handleTestConnection();
        toast({
          title: "Testing Connection",
          description: "Initiating connection test as requested...",
        });
      } else if (lastAction.type === 'SUGGEST_FIX') {
        // FIX: Added SUGGEST_FIX handler
        const troubleshooting = lastAction.data;
        const fixes = troubleshooting.suggested_fixes || [];
        const warnings = troubleshooting.security_warnings || [];

        let description = '';
        if (fixes.length > 0) {
          description += `Suggestions:\n${fixes.map((fix, i) => `${i + 1}. ${fix}`).join('\n')}`;
        }
        if (warnings.length > 0) {
          description += `\n\nWarnings:\n${warnings.map((warn, i) => `⚠️ ${warn}`).join('\n')}`;
        }

        toast({
          title: `Troubleshooting: ${troubleshooting.error_type || 'Connection Issue'}`,
          description: description || 'No specific suggestions available.',
          duration: 15000, // Longer duration for troubleshooting info
        });
      }
    }
  }, [actions, savedConnections]);



  const handleAIGenerate = async (prompt: string) => {
    setGenerating(true);
    try {
      await sendMessage(prompt);
    } catch (error: any) {
      console.error("AI Generation failed:", error);
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      toast({
        title: "Generation Failed",
        description: `Could not generate connection details: ${errorMsg}`,
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Saved Connections List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Saved Connections</h3>
            <div className="flex items-center gap-2">
              <Button onClick={() => {
                setShowNewForm(!showNewForm);
                if (!showNewForm) {
                  setEditingConnectionId(null);
                  resetAllForms();
                }
              }}>
                {showNewForm ? 'Cancel' : 'Add New Connection'}
              </Button>
            </div>
          </div>

          {!showNewForm && (
            <div className="space-y-4">
              {/* Embedded AI for creating new connection */}
              <Card className="p-4 border-dashed border-2 bg-muted/20">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm text-muted-foreground">✨ Describe a connection to create it instantly</Label>
                  <AIInput
                    placeholder="e.g., 'Create a MySQL connection to localhost named Local DB'"
                    onGenerate={handleAIGenerate}
                    isLoading={generating}
                  />
                </div>
              </Card>

              {savedConnections.length === 0 ? (
                <Card className="p-8 text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No saved connections yet</p>
                  <Button onClick={() => setShowNewForm(true)}>Create Your First Connection</Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedConnections.map((conn) => (
                    <Card key={conn.id} className="p-4 flex flex-col hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate" title={conn.name}>{conn.name}</h3>
                          <p className="text-xs text-muted-foreground truncate" title={`${conn.type.toUpperCase()} - ${conn.host}${conn.instance ? '\\' + conn.instance : ''}`}>
                            {conn.type.toUpperCase()} - {conn.host}
                            {conn.instance && `\\${conn.instance}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-auto">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => {
                                if (connectionId === conn.id && databaseTree.length > 0) {
                                  // Collapse
                                  setConnectionId(null);
                                  setDatabaseTree([]);
                                } else {
                                  // Fetch
                                  handleFetchDatabases(conn.id);
                                }
                              }}
                              disabled={loadingDatabases && connectionId === conn.id}
                            >
                              {loadingDatabases && connectionId === conn.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : connectionId === conn.id && databaseTree.length > 0 ? (
                                <X className="h-3.5 w-3.5" />
                              ) : (
                                <Database className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {connectionId === conn.id && databaseTree.length > 0
                              ? 'Collapse Database Structure'
                              : 'Fetch Database Structure'}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => handleDuplicateConnection(conn)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => handleEditConnection(conn)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2"
                              onClick={() => {
                                setConnectionToDelete(conn);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                      {loadingDatabases && connectionId === conn.id ? (
                        <div className="mt-4 pt-4 border-t flex flex-col items-center justify-center space-y-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-xs text-muted-foreground italic">{fetchingStatus || 'Fetching database structure...'}</p>
                        </div>
                      ) : connectionId === conn.id && databaseTree.length > 0 ? (
                        <div className="mt-4 pt-4 border-t">
                          <DatabaseTree
                            data={databaseTree}
                            loading={loadingDatabases && connectionId === conn.id}
                            error={connectionId === conn.id ? metadataError : null}
                          />
                        </div>
                      ) : connectionId === conn.id && metadataError ? (
                        <div className="mt-4 pt-4 border-t">
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">{metadataError}</AlertDescription>
                          </Alert>
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* New/Edit Connection Form */}
        {showNewForm && (
          <Card className="p-6">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">
                {editingConnectionId ? 'Edit Connection' : 'New Connection'}
              </h3>
              <div>
                <div className="flex items-center gap-2">
                  <Label>Database Type <span className="text-destructive">*</span></Label>
                  <HelpTooltip {...helpContent.connections.databaseType} />
                </div>
                <Select value={dbType} onValueChange={(v: any) => setDbType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mssql">MS SQL Server</SelectItem>
                    <SelectItem value="azuresql">Azure SQL Database</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="oracle">Oracle Database</SelectItem>
                    <SelectItem value="databricks">Databricks</SelectItem>
                    <SelectItem value="snowflake">Snowflake</SelectItem>
                    <SelectItem value="redshift">Amazon Redshift</SelectItem>
                    <SelectItem value="mariadb">MariaDB</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Use Connection String</Label>
                  <HelpTooltip {...helpContent.connections.useConnectionString} />
                </div>
                <Switch
                  checked={useConnectionString}
                  onCheckedChange={setUseConnectionString}
                />
              </div>

              {useConnectionString ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label>Connection Name <span className="text-destructive">*</span></Label>
                      <HelpTooltip content="A descriptive name to identify this connection" />
                    </div>
                    <Input
                      value={dbType === 'mssql' ? mssqlData.name : mysqlData.name}
                      onChange={(e) => {
                        if (dbType === 'mssql') {
                          setMssqlData({ ...mssqlData, name: e.target.value });
                        } else {
                          setMysqlData({ ...mysqlData, name: e.target.value });
                        }
                      }}
                      placeholder="My Connection"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label>Connection String <span className="text-destructive">*</span></Label>
                      <HelpTooltip {...helpContent.connections.connectionString} />
                    </div>
                    <Input
                      value={connectionString}
                      onChange={(e) => setConnectionString(e.target.value)}
                      placeholder={
                        dbType === 'mssql'
                          ? 'Server=localhost;Database=mydb;User Id=sa;Password=...'
                          : 'mysql://user:password@localhost:3306/database'
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">

                  {/* Dynamic Connection Form Fields */}
                  {(dbType === 'mssql' || dbType === 'azuresql') ? (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Connection Name <span className="text-destructive">*</span></Label>
                          <HelpTooltip content="A descriptive name to identify this connection" />
                        </div>
                        <Input
                          value={dbType === 'mssql' ? mssqlData.name : azureSqlData.name}
                          onChange={(e) => dbType === 'mssql'
                            ? setMssqlData({ ...mssqlData, name: e.target.value })
                            : setAzureSqlData({ ...azureSqlData, name: e.target.value })
                          }
                          placeholder={dbType === 'mssql' ? "Production MSSQL" : "Azure SQL Database"}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Label>Server Host <span className="text-destructive">*</span></Label>
                            <HelpTooltip content="Server address (e.g., localhost, 192.168.1.100, db.example.com)" />
                          </div>
                          <Input
                            value={dbType === 'mssql' ? mssqlData.host : azureSqlData.host}
                            onChange={(e) => dbType === 'mssql'
                              ? setMssqlData({ ...mssqlData, host: e.target.value })
                              : setAzureSqlData({ ...azureSqlData, host: e.target.value })
                            }
                            placeholder={dbType === 'mssql' ? "localhost" : "server.database.windows.net"}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Label>Port <span className="text-destructive">*</span></Label>
                            <HelpTooltip content="Database port (default: 1433 for MSSQL)" />
                          </div>
                          <Input
                            value={dbType === 'mssql' ? mssqlData.port : azureSqlData.port}
                            onChange={(e) => dbType === 'mssql'
                              ? setMssqlData({ ...mssqlData, port: e.target.value })
                              : setAzureSqlData({ ...azureSqlData, port: e.target.value })
                            }
                            placeholder="1433"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Instance <span className="text-destructive">*</span></Label>
                          <HelpTooltip {...helpContent.connections.instance} />
                        </div>
                        <Input
                          value={dbType === 'mssql' ? mssqlData.instance : azureSqlData.instance}
                          onChange={(e) => dbType === 'mssql'
                            ? setMssqlData({ ...mssqlData, instance: e.target.value })
                            : setAzureSqlData({ ...azureSqlData, instance: e.target.value })
                          }
                          placeholder={dbType === 'mssql' ? "SQLEXPRESS" : "(Optional for Azure)"}
                          required
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Initial Database <span className="text-destructive">*</span></Label>
                          <HelpTooltip {...helpContent.connections.initialDatabase} />
                        </div>
                        <Input
                          value={dbType === 'mssql' ? mssqlData.initialDatabase : azureSqlData.initialDatabase}
                          onChange={(e) => dbType === 'mssql'
                            ? setMssqlData({ ...mssqlData, initialDatabase: e.target.value })
                            : setAzureSqlData({ ...azureSqlData, initialDatabase: e.target.value })
                          }
                          placeholder="master"
                          required
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label>Trusted Connection (Windows Auth)</Label>
                          <HelpTooltip {...helpContent.connections.trustedConnection} />
                        </div>
                        <Switch
                          checked={dbType === 'mssql' ? mssqlData.trustedConnection : azureSqlData.trustedConnection}
                          onCheckedChange={(checked) => dbType === 'mssql'
                            ? setMssqlData({ ...mssqlData, trustedConnection: checked })
                            : setAzureSqlData({ ...azureSqlData, trustedConnection: checked })
                          }
                        />
                      </div>
                      {!(dbType === 'mssql' ? mssqlData.trustedConnection : azureSqlData.trustedConnection) && (
                        <>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Label>Username <span className="text-destructive">*</span></Label>
                              <HelpTooltip content="Database username for authentication" />
                            </div>
                            <Input
                              value={dbType === 'mssql' ? mssqlData.username : azureSqlData.username}
                              onChange={(e) => dbType === 'mssql'
                                ? setMssqlData({ ...mssqlData, username: e.target.value })
                                : setAzureSqlData({ ...azureSqlData, username: e.target.value })
                              }
                              placeholder="sa"
                            />
                          </div>
                          <div>
                            <Label>Password</Label>
                            <Input
                              type="password"
                              value={dbType === 'mssql' ? mssqlData.password : azureSqlData.password}
                              onChange={(e) => dbType === 'mssql'
                                ? setMssqlData({ ...mssqlData, password: e.target.value })
                                : setAzureSqlData({ ...azureSqlData, password: e.target.value })
                              }
                              placeholder="••••••••"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>SSL/TLS Encryption</Label>
                              <HelpTooltip {...helpContent.connections.ssl} />
                            </div>
                            <Switch
                              checked={dbType === 'mssql' ? mssqlData.ssl : azureSqlData.ssl}
                              onCheckedChange={(checked) => dbType === 'mssql'
                                ? setMssqlData({ ...mssqlData, ssl: checked })
                                : setAzureSqlData({ ...azureSqlData, ssl: checked })
                              }
                            />
                          </div>
                        </>
                      )}
                    </>
                  ) : dbType === 'mysql' || dbType === 'mariadb' ? (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Connection Name <span className="text-destructive">*</span></Label>
                          <HelpTooltip content="A descriptive name to identify this connection" />
                        </div>
                        <Input
                          value={dbType === 'mariadb' ? mariadbData.name : mysqlData.name}
                          onChange={(e) => dbType === 'mariadb' ? setMariadbData({ ...mariadbData, name: e.target.value }) : setMysqlData({ ...mysqlData, name: e.target.value })}
                          placeholder={dbType === 'mariadb' ? "My MariaDB" : "Production MySQL"}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Label>Host <span className="text-destructive">*</span></Label>
                            <HelpTooltip content="Server address (e.g., localhost, 192.168.1.100, db.example.com)" />
                          </div>
                          <Input
                            value={dbType === 'mariadb' ? mariadbData.host : mysqlData.host}
                            onChange={(e) => dbType === 'mariadb' ? setMariadbData({ ...mariadbData, host: e.target.value }) : setMysqlData({ ...mysqlData, host: e.target.value })}
                            placeholder="localhost"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Label>Port</Label>
                            <HelpTooltip content="Database port (default: 1433 for MSSQL, 3306 for MySQL/MariaDB)" />
                          </div>
                          <Input
                            value={dbType === 'mariadb' ? mariadbData.port : mysqlData.port}
                            onChange={(e) => dbType === 'mariadb' ? setMariadbData({ ...mariadbData, port: e.target.value }) : setMysqlData({ ...mysqlData, port: e.target.value })}
                            placeholder="3306"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Database</Label>
                          <HelpTooltip {...helpContent.connections.initialDatabase} />
                        </div>
                        <Input
                          value={dbType === 'mariadb' ? mariadbData.database : mysqlData.database}
                          onChange={(e) => dbType === 'mariadb' ? setMariadbData({ ...mariadbData, database: e.target.value }) : setMysqlData({ ...mysqlData, database: e.target.value })}
                          placeholder="mydb"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Username <span className="text-destructive">*</span></Label>
                          <HelpTooltip content="Database username for authentication" />
                        </div>
                        <Input
                          value={dbType === 'mariadb' ? mariadbData.username : mysqlData.username}
                          onChange={(e) => dbType === 'mariadb' ? setMariadbData({ ...mariadbData, username: e.target.value }) : setMysqlData({ ...mysqlData, username: e.target.value })}
                          placeholder="root"
                        />
                      </div>
                      <div>
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={dbType === 'mariadb' ? mariadbData.password : mysqlData.password}
                          onChange={(e) => dbType === 'mariadb' ? setMariadbData({ ...mariadbData, password: e.target.value }) : setMysqlData({ ...mysqlData, password: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Charset</Label>
                          <HelpTooltip content="Character set for the connection (default: utf8mb4)" />
                        </div>
                        <Input
                          value={dbType === 'mariadb' ? mariadbData.charset : mysqlData.charset}
                          onChange={(e) => dbType === 'mariadb' ? setMariadbData({ ...mariadbData, charset: e.target.value }) : setMysqlData({ ...mysqlData, charset: e.target.value })}
                          placeholder="utf8mb4"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label>SSL/TLS Encryption</Label>
                          <HelpTooltip {...helpContent.connections.ssl} />
                        </div>
                        <Switch
                          checked={dbType === 'mariadb' ? mariadbData.ssl : mysqlData.ssl}
                          onCheckedChange={(checked) =>
                            dbType === 'mariadb' ? setMariadbData({ ...mariadbData, ssl: checked }) : setMysqlData({ ...mysqlData, ssl: checked })
                          }
                        />
                      </div>
                    </>
                  ) : dbType === 'postgresql' ? (
                    <PostgreSQLForm data={postgresData} onChange={setPostgresData} />
                  ) : dbType === 'oracle' ? (
                    <OracleForm data={oracleData} onChange={setOracleData} />
                  ) : dbType === 'databricks' ? (
                    <DatabricksForm data={databricksData} onChange={setDatabricksData} />
                  ) : dbType === 'snowflake' ? (
                    <SnowflakeForm data={snowflakeData} onChange={setSnowflakeData} />
                  ) : dbType === 'redshift' ? (
                    <RedshiftForm data={redshiftData} onChange={setRedshiftData} />
                  ) : dbType === 'sqlite' ? (
                    <SQLiteForm data={sqliteData} onChange={setSqliteData} />
                  ) : null}



                  <div className="flex gap-2">
                    <Button
                      onClick={handleTestConnection}
                      disabled={testing}
                      variant="outline"
                    >
                      {testing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : testStatus === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test Connection
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            onClick={handleSaveConnection}
                            disabled={!testSuccess || saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Database className="h-4 w-4 mr-2" />
                            )}
                            {editingConnectionId ? 'Update Connection' : 'Save Connection'}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!testSuccess && (
                        <TooltipContent>
                          <p>Test the connection first before saving</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            onClick={() => {
                              if (editingConnectionId) {
                                handleFetchDatabases({ id: editingConnectionId });
                              }
                            }}
                            disabled={!editingConnectionId || loadingDatabases}
                            variant="outline"
                          >
                            {loadingDatabases ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Database className="h-4 w-4 mr-2" />
                            )}
                            Fetch Databases
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!editingConnectionId && (
                        <TooltipContent>
                          <p>Save the connection first to fetch databases</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <Button
                      onClick={() => {
                        setShowNewForm(false);
                        setEditingConnectionId(null);
                        setDatabaseTree([]);
                        setConnectionId(null);
                        resetAllForms();
                      }}
                      variant="outline"
                    >
                      Close
                    </Button>
                  </div>

                  {testError && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>{testError}</span>
                        <AIButton
                          onClick={() => handleAITroubleshoot(testError)}
                          label="Troubleshoot"
                          size="sm"
                          variant="outline"
                          className="h-7 bg-background/50 hover:bg-background/80 border-destructive/30 text-destructive-foreground"
                          isLoading={aiAction === 'troubleshoot'}
                        />
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Database Tree Section */}
                  {editingConnectionId && connectionId === editingConnectionId && databaseTree.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Database className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold text-base">Database Structure</h4>
                        <Badge variant="secondary" className="ml-auto">
                          {databaseTree.length} {databaseTree.length === 1 ? 'Database' : 'Databases'}
                        </Badge>
                      </div>
                      <DatabaseTree data={databaseTree} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div >

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{connectionToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConnection}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AIResponseModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title={aiModalTitle}
        content={aiModalContent}
        isLoading={aiLoading}
      />
    </>
  );
}
