import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Database, TestTube, Trash2, Info, AlertCircle, Pencil, Copy, CheckCircle2, Sparkles, X, Eye, EyeOff, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
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

  // AI State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState('');
  const [aiModalContent, setAiModalContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [showSqlPassword, setShowSqlPassword] = useState(false);
  const [connectionSearchTerm, setConnectionSearchTerm] = useState('');
  const [connectionSortBy, setConnectionSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'type_asc'>('newest');
  const [currentConnectionsPage, setCurrentConnectionsPage] = useState(1);
  const [connectionsPerPage, setConnectionsPerPage] = useState(12);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  const filteredConnections = useMemo(() => {
    const searchTerm = connectionSearchTerm.trim().toLowerCase();
    const base = savedConnections.filter((conn) => {
      const name = (conn.name || '').toLowerCase();
      const type = (conn.type || '').toLowerCase();
      const host = (conn.host || '').toLowerCase();
      const instance = (conn.instance || '').toLowerCase();
      return (
        name.includes(searchTerm) ||
        type.includes(searchTerm) ||
        host.includes(searchTerm) ||
        instance.includes(searchTerm)
      );
    });

    const byDate = (conn: any) => {
      const ts = conn?.created_at ? new Date(conn.created_at).getTime() : 0;
      return Number.isNaN(ts) ? 0 : ts;
    };

    return [...base].sort((a, b) => {
      if (connectionSortBy === 'name_asc') return String(a?.name || '').localeCompare(String(b?.name || ''));
      if (connectionSortBy === 'name_desc') return String(b?.name || '').localeCompare(String(a?.name || ''));
      if (connectionSortBy === 'type_asc') return String(a?.type || '').localeCompare(String(b?.type || ''));
      if (connectionSortBy === 'oldest') return byDate(a) - byDate(b);
      return byDate(b) - byDate(a); // newest
    });
  }, [savedConnections, connectionSearchTerm, connectionSortBy]);

  const totalConnectionsPages = Math.max(1, Math.ceil(filteredConnections.length / connectionsPerPage));
  const paginatedConnections = useMemo(() => {
    const startIndex = (currentConnectionsPage - 1) * connectionsPerPage;
    return filteredConnections.slice(startIndex, startIndex + connectionsPerPage);
  }, [filteredConnections, currentConnectionsPage, connectionsPerPage]);

  const connectionsPaginationItems = useMemo(() => {
    const pages: Array<number | string> = [];

    if (totalConnectionsPages <= 7) {
      for (let page = 1; page <= totalConnectionsPages; page += 1) {
        pages.push(page);
      }
      return pages;
    }

    pages.push(1);

    const start = Math.max(2, currentConnectionsPage - 1);
    const end = Math.min(totalConnectionsPages - 1, currentConnectionsPage + 1);

    if (start > 2) pages.push('ellipsis-start');
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    if (end < totalConnectionsPages - 1) pages.push('ellipsis-end');

    pages.push(totalConnectionsPages);
    return pages;
  }, [currentConnectionsPage, totalConnectionsPages]);

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

  useEffect(() => {
    setCurrentConnectionsPage(1);
  }, [connectionSearchTerm, connectionSortBy, connectionsPerPage, savedConnections.length]);

  useEffect(() => {
    setSelectedConnectionIds((prev) => {
      const validIds = new Set(savedConnections.map((conn) => conn.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [savedConnections]);

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
    setShowSqlPassword(false);
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
          context: 'etl',
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

  const normalizeSqlServerPayload = (
    type: 'mssql' | 'azuresql',
    data: typeof mssqlData
  ) => {
    const trusted = type === 'azuresql' ? false : !!data.trustedConnection;
    const username = trusted ? undefined : (data.username?.trim() || undefined);
    const password = trusted ? undefined : (data.password || undefined);
    const parsedPort = data.port ? parseInt(data.port, 10) : undefined;
    const normalizedInstance = (data.instance && data.instance.trim()) || undefined;
    let normalizedPort = Number.isFinite(parsedPort as number) ? parsedPort : undefined;

    // For named MSSQL instances, default 1433 is often wrong (e.g., SQLEXPRESS dynamic ports).
    // If user provided instance and left default 1433, prefer instance resolution via SQL Browser.
    if (type === 'mssql' && normalizedInstance && normalizedPort === 1433) {
      normalizedPort = undefined;
    }

    return {
      type,
      name: data.name,
      host: data.host,
      port: normalizedPort,
      instance: normalizedInstance,
      database: data.initialDatabase || undefined,
      trusted,
      username,
      password,
      ssl: data.ssl,
    };
  };

  const validateSqlServerAuthInput = (
    type: 'mssql' | 'azuresql',
    data: typeof mssqlData,
    options?: { allowSavedPassword?: boolean }
  ) => {
    const trusted = type === 'mssql' ? !!data.trustedConnection : false;
    const allowSavedPassword = !!options?.allowSavedPassword;
    if (!trusted && !data.username?.trim()) {
      toast({
        title: 'Validation Failed',
        description: 'Username is required when Windows Authentication is off.',
        variant: 'destructive',
      });
      return false;
    }
    if (!trusted && !data.password && !allowSavedPassword) {
      toast({
        title: 'Validation Failed',
        description: 'Password is required when Windows Authentication is off.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
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

      if (dbType === 'mssql' || dbType === 'azuresql') {
        const sqlData = dbType === 'mssql' ? mssqlData : azureSqlData;
        if (!validateSqlServerAuthInput(dbType, sqlData)) {
          return;
        }
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
          ...normalizeSqlServerPayload(dbType, data),
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
        trustedConnection: conn.type === 'azuresql' ? false : (conn.trusted || false),
        username: conn.username || '',
        password: conn.password || '',
        ssl: conn.ssl || (conn.type === 'azuresql'),
      };
      if (conn.type === 'mssql') setMssqlData(data);
      else {
        setAzureSqlData(data);
        if (conn.trusted) {
          toast({
            title: 'Azure SQL Authentication Adjusted',
            description: 'Windows Authentication is not supported for Azure SQL. Trusted Connection was turned off.',
          });
        }
      }
    } else if (conn.type === 'mysql' || conn.type === 'mariadb') {
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
      if (conn.type === 'mariadb') {
        setMariadbData({
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
    } else if (conn.type === 'postgresql') {
      setPostgresData({
        name: `${conn.name} - Copy`,
        host: conn.host || '',
        port: conn.port?.toString() || '5432',
        database: conn.database || '',
        username: conn.username || '',
        password: conn.password || '',
        schema: conn.schema || conn.schema_name || 'public',
        ssl: conn.ssl || false,
      });
    } else if (conn.type === 'oracle') {
      setOracleData({
        name: `${conn.name} - Copy`,
        host: conn.host || '',
        port: conn.port?.toString() || '1521',
        serviceName: conn.serviceName || conn.service_name || '',
        username: conn.username || '',
        password: conn.password || '',
        ssl: conn.ssl || false,
      });
    } else if (conn.type === 'databricks') {
      setDatabricksData({
        name: `${conn.name} - Copy`,
        host: conn.host || '',
        httpPath: conn.httpPath || conn.http_path || '',
        token: conn.token || '',
        catalog: conn.catalog || 'hive_metastore',
        schema: conn.schema || conn.schema_name || 'default',
      });
    } else if (conn.type === 'snowflake') {
      setSnowflakeData({
        name: `${conn.name} - Copy`,
        account: conn.account || '',
        username: conn.username || '',
        password: conn.password || '',
        warehouse: conn.warehouse || '',
        database: conn.database || '',
        schema: conn.schema || conn.schema_name || 'PUBLIC',
        role: conn.role || '',
      });
    } else if (conn.type === 'redshift') {
      setRedshiftData({
        name: `${conn.name} - Copy`,
        host: conn.host || '',
        port: conn.port?.toString() || '5439',
        database: conn.database || '',
        username: conn.username || '',
        password: conn.password || '',
        schema: conn.schema || conn.schema_name || 'public',
        ssl: conn.ssl ?? true,
      });
    } else if (conn.type === 'sqlite') {
      setSqliteData({
        name: `${conn.name} - Copy`,
        filePath: conn.filePath || conn.file_path || '',
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

    if (!useConnectionString && (dbType === 'mssql' || dbType === 'azuresql')) {
      const sqlData = dbType === 'mssql' ? mssqlData : azureSqlData;
      const existingConn = editingConnectionId
        ? savedConnections.find((conn: any) => conn.id === editingConnectionId)
        : null;
      const allowSavedPassword = !!editingConnectionId && !!existingConn?.password && !sqlData.password;
      if (!validateSqlServerAuthInput(dbType, sqlData, { allowSavedPassword })) {
        return;
      }
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
        payload = normalizeSqlServerPayload(dbType, data);
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
    setShowSqlPassword(false);

    if (conn.type === 'mssql') {
      setMssqlData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '1433',
        instance: conn.instance || '',
        initialDatabase: conn.database || '',
        trustedConnection: conn.trusted || false,
        username: conn.username || '',
        password: conn.password || '',
        ssl: conn.ssl || false,
      });
    } else if (conn.type === 'azuresql') {
      setAzureSqlData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '1433',
        instance: conn.instance || '',
        initialDatabase: conn.database || '',
        trustedConnection: false,
        username: conn.username || '',
        password: conn.password || '',
        ssl: true,
      });
      if (conn.trusted) {
        toast({
          title: 'Azure SQL Authentication Adjusted',
          description: 'Windows Authentication is not supported for Azure SQL. Trusted Connection was turned off.',
        });
      }
    } else if (conn.type === 'mysql') {
      setMysqlData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '3306',
        database: conn.database || '',
        username: conn.username || '',
        password: conn.password || '',
        charset: conn.charset || 'utf8mb4',
        ssl: conn.ssl || false,
      });
    } else if (conn.type === 'mariadb') {
      setMariadbData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '3306',
        database: conn.database || '',
        username: conn.username || '',
        password: conn.password || '',
        charset: conn.charset || 'utf8mb4',
        ssl: conn.ssl || false,
      });
    } else if (conn.type === 'postgresql') {
      setPostgresData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '5432',
        database: conn.database || '',
        username: conn.username || '',
        password: conn.password || '',
        schema: conn.schema || conn.schema_name || 'public',
        ssl: conn.ssl || false,
      });
    } else if (conn.type === 'oracle') {
      setOracleData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '1521',
        serviceName: conn.serviceName || conn.service_name || '',
        username: conn.username || '',
        password: conn.password || '',
        ssl: conn.ssl || false,
      });
    } else if (conn.type === 'databricks') {
      setDatabricksData({
        name: conn.name || '',
        host: conn.host || '',
        httpPath: conn.httpPath || conn.http_path || '',
        token: conn.token || '',
        catalog: conn.catalog || 'hive_metastore',
        schema: conn.schema || conn.schema_name || 'default',
      });
    } else if (conn.type === 'snowflake') {
      setSnowflakeData({
        name: conn.name || '',
        account: conn.account || '',
        username: conn.username || '',
        password: conn.password || '',
        warehouse: conn.warehouse || '',
        database: conn.database || '',
        schema: conn.schema || conn.schema_name || 'PUBLIC',
        role: conn.role || '',
      });
    } else if (conn.type === 'redshift') {
      setRedshiftData({
        name: conn.name || '',
        host: conn.host || '',
        port: conn.port?.toString() || '5439',
        database: conn.database || '',
        username: conn.username || '',
        password: conn.password || '',
        schema: conn.schema || conn.schema_name || 'public',
        ssl: conn.ssl ?? true,
      });
    } else if (conn.type === 'sqlite') {
      setSqliteData({
        name: conn.name || '',
        filePath: conn.filePath || conn.file_path || '',
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

  const handleFetchDatabases = async (id: string | { id?: string }) => {
    const connectionIdToFetch =
      typeof id === 'string'
        ? id
        : (id && typeof id.id === 'string' ? id.id : '');

    if (!connectionIdToFetch) {
      toast({
        title: "Invalid Connection",
        description: "No valid connection id found to fetch metadata.",
        variant: "destructive",
      });
      return;
    }

    let isPollingJob = false;
    setConnectionId(connectionIdToFetch);
    setLoadingDatabases(true);
    setMetadataError(null);
    setFetchingStatus(null);

    try {
      console.log('Fetching databases for connection:', connectionIdToFetch);
      const res = await connectionsApi.metadata(connectionIdToFetch, agentId);

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

      if (data && data.jobId) {
        isPollingJob = true;
        setFetchingStatus('Agent is fetching database metadata...');
        const jobId = data.jobId as string;
        const startTime = Date.now();
        const timeout = 60000;

        const pollInterval = setInterval(async () => {
          if (Date.now() - startTime > timeout) {
            clearInterval(pollInterval);
            setLoadingDatabases(false);
            setFetchingStatus(null);
            setMetadataError('Metadata fetch timed out');
            toast({
              title: 'Fetch Failed',
              description: 'Agent did not return metadata in time.',
              variant: 'destructive',
            });
            return;
          }

          const { data: job, error: jobError } = await connectionsApi.getJob(jobId) as any;
          if (jobError || !job) return;

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setFetchingStatus(null);
            setLoadingDatabases(false);
            const jobResult = job.result || {};
            if (jobResult.databases) {
              setConnectionId(connectionIdToFetch);
              setDatabaseTree(jobResult.databases);
              toast({
                title: 'Databases Fetched',
                description: 'Metadata retrieved successfully via agent.',
              });
            } else {
              setMetadataError('No databases found in metadata response');
            }
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setFetchingStatus(null);
            setLoadingDatabases(false);
            const msg = job.error_log || 'Metadata fetch failed';
            setMetadataError(msg);
            toast({
              title: 'Fetch Failed',
              description: msg,
              variant: 'destructive',
            });
          }
        }, 2000);
        return;
      }

      // Handle Direct Sync Result
      if (data && data.databases) {
        setConnectionId(connectionIdToFetch);
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
      // Only set loading to false if we're not polling job status.
      if (!isPollingJob) {
        setLoadingDatabases(false);
      }
    }
  };

  const renderConnectionActions = (conn: any) => (
    <div className="flex items-center justify-end gap-0.5">
      {connectionId === conn.id && (databaseTree.length > 0 || loadingDatabases || !!metadataError) ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground/80 hover:bg-muted/60"
          title="Hide Database Structure"
          onClick={() => {
            setConnectionId(null);
            setDatabaseTree([]);
            setMetadataError(null);
            setFetchingStatus(null);
          }}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      ) : (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-foreground/80 hover:bg-muted/60"
        title="Fetch Database Structure"
        onClick={() => {
          handleFetchDatabases(conn.id);
        }}
        disabled={loadingDatabases && connectionId === conn.id}
      >
        <Database className="h-3.5 w-3.5" />
      </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-foreground/80 hover:bg-muted/60"
        title="Duplicate"
        onClick={() => handleDuplicateConnection(conn)}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-foreground/80 hover:bg-muted/60"
        title="Edit"
        onClick={() => handleEditConnection(conn)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive/90 hover:bg-destructive/10 hover:text-destructive"
        title="Delete"
        onClick={() => {
          setConnectionToDelete(conn);
          setDeleteDialogOpen(true);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const toggleConnectionSelection = (id: string, checked: boolean) => {
    setSelectedConnectionIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allPageConnectionsSelected = paginatedConnections.length > 0 && paginatedConnections.every((conn) => selectedConnectionIds.has(conn.id));
  const somePageConnectionsSelected = paginatedConnections.some((conn) => selectedConnectionIds.has(conn.id));

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedConnectionIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        paginatedConnections.forEach((conn) => next.add(conn.id));
      } else {
        paginatedConnections.forEach((conn) => next.delete(conn.id));
      }
      return next;
    });
  };

  const buildConnectionPayloadFromSaved = (conn: any, copySuffix = '') => {
    const payload: any = {
      type: conn.type,
      name: `${conn.name || 'Connection'}${copySuffix}`,
    };

    const copyFields = [
      'host', 'port', 'instance', 'database', 'username', 'password', 'ssl', 'schema', 'schema_name',
      'trusted', 'serviceName', 'service_name', 'httpPath', 'http_path', 'token', 'catalog', 'account',
      'warehouse', 'role', 'charset', 'filePath', 'file_path'
    ];

    copyFields.forEach((key) => {
      if (conn[key] !== undefined && conn[key] !== null && conn[key] !== '') {
        payload[key] = conn[key];
      }
    });

    return payload;
  };

  const handleBulkDuplicateConnections = async () => {
    if (selectedConnectionIds.size === 0) return;

    setBulkActionInProgress(true);
    let successCount = 0;
    let failedCount = 0;

    for (const conn of savedConnections) {
      if (!selectedConnectionIds.has(conn.id)) continue;
      const payload = buildConnectionPayloadFromSaved(conn, ' - Copy');
      const { error } = await connectionsApi.save(payload);
      if (error) failedCount += 1;
      else successCount += 1;
    }

    setBulkActionInProgress(false);
    setSelectedConnectionIds(new Set());
    await loadSavedConnections();

    if (failedCount > 0) {
      toast({
        title: 'Bulk Copy Completed',
        description: `${successCount} copied, ${failedCount} failed.`,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Connections Copied',
      description: `${successCount} connection${successCount === 1 ? '' : 's'} copied successfully.`,
    });
  };

  const handleBulkDeleteConnections = async () => {
    if (selectedConnectionIds.size === 0) return;

    setBulkActionInProgress(true);
    let successCount = 0;
    let failedCount = 0;

    for (const connId of Array.from(selectedConnectionIds)) {
      const { error } = await connectionsApi.delete(connId);
      if (error) failedCount += 1;
      else successCount += 1;
    }

    setBulkActionInProgress(false);
    setBulkDeleteDialogOpen(false);
    setSelectedConnectionIds(new Set());
    if (connectionId && !savedConnections.some((conn) => conn.id === connectionId && !selectedConnectionIds.has(conn.id))) {
      setConnectionId(null);
      setDatabaseTree([]);
    }
    await loadSavedConnections();
    onConnectionDeleted?.();

    if (failedCount > 0) {
      toast({
        title: 'Bulk Delete Completed',
        description: `${successCount} deleted, ${failedCount} failed.`,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Connections Deleted',
      description: `${successCount} connection${successCount === 1 ? '' : 's'} deleted successfully.`,
    });
  };

  const renderConnectionDetails = (conn: any) => {
    if (loadingDatabases && connectionId === conn.id) {
      return (
        <div className="mt-4 pt-4 border-t flex flex-col items-center justify-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground italic">{fetchingStatus || 'Fetching database structure...'}</p>
        </div>
      );
    }

    if (connectionId === conn.id && databaseTree.length > 0) {
      return (
        <div className="mt-4 pt-4 border-t">
          <DatabaseTree
            data={databaseTree}
            loading={loadingDatabases && connectionId === conn.id}
            error={connectionId === conn.id ? metadataError : null}
          />
        </div>
      );
    }

    if (connectionId === conn.id && metadataError) {
      return (
        <div className="mt-4 pt-4 border-t">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{metadataError}</AlertDescription>
          </Alert>
        </div>
      );
    }

    return null;
  };

  const formatCreatedAt = (value: string | null | undefined) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Saved Connections List */}
        <div>
          <div className="mb-4 space-y-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Saved Connections</h3>
              <p className="text-sm text-muted-foreground">Manage and reuse database endpoints for ETL validation and execution.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!showNewForm && savedConnections.length > 0 && (
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8 pr-8"
                    placeholder="Search by name, type, host, instance..."
                    value={connectionSearchTerm}
                    onChange={(e) => setConnectionSearchTerm(e.target.value)}
                  />
                  {connectionSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setConnectionSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {!showNewForm && savedConnections.length > 0 && (
                <Select value={connectionSortBy} onValueChange={(value: any) => setConnectionSortBy(value)}>
                  <SelectTrigger className="h-9 w-full sm:w-[170px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="name_asc">Name A-Z</SelectItem>
                    <SelectItem value="name_desc">Name Z-A</SelectItem>
                    <SelectItem value="type_asc">Type A-Z</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Button
                onClick={() => {
                  setShowNewForm(!showNewForm);
                  if (!showNewForm) {
                    setEditingConnectionId(null);
                    resetAllForms();
                  }
                }}
                className="h-9 sm:ml-auto"
              >
                {showNewForm ? 'Cancel' : 'Add New Connection'}
              </Button>
            </div>

            {!showNewForm && savedConnections.length > 0 && selectedConnectionIds.size > 0 && (
              <div className="inline-flex w-fit flex-wrap items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2 py-1.5 text-sm text-muted-foreground shadow-sm">
                <span className="rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                  {selectedConnectionIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-md px-3 text-sm text-foreground/85 hover:bg-muted hover:text-foreground"
                  disabled={bulkActionInProgress}
                  onClick={handleBulkDuplicateConnections}
                >
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-md px-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={bulkActionInProgress}
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-md px-3 text-sm text-foreground/85 hover:bg-muted hover:text-foreground"
                  onClick={() => setSelectedConnectionIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {!showNewForm && (
            <div className="space-y-4">
              {savedConnections.length === 0 ? (
                <Card className="p-8 text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No saved connections yet</p>
                  <Button onClick={() => setShowNewForm(true)}>Create Your First Connection</Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredConnections.length === 0 ? (
                    <Card className="border-border/80 p-6 text-center">
                      <p className="text-sm font-medium">No connections match your search.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try a different term or clear the current filter.</p>
                    </Card>
                  ) : (
                    <Card className="overflow-hidden border-border shadow-sm bg-card">
                      <div className="hidden md:grid grid-cols-[minmax(240px,2.6fr)_minmax(90px,0.9fr)_minmax(180px,2fr)_minmax(180px,2fr)_minmax(100px,1fr)_132px] items-center border-b bg-muted/65 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/85">
                        <span className="flex items-center gap-2">
                          {selectedConnectionIds.size > 0 && (
                            <Checkbox
                              checked={allPageConnectionsSelected ? true : (somePageConnectionsSelected ? 'indeterminate' : false)}
                              onCheckedChange={(checked) => toggleSelectAllOnPage(checked === true)}
                              aria-label="Select all on page"
                            />
                          )}
                          Name
                        </span>
                        <span>Type</span>
                        <span>Host / Instance</span>
                        <span>Database</span>
                        <span>Created</span>
                        <span className="text-right">Actions</span>
                      </div>
                      <div className="divide-y divide-border/90">
                        {paginatedConnections.map((conn) => (
                          <div key={conn.id} className="group px-3 py-1 transition-colors hover:bg-muted/40">
                            <div className="hidden md:grid md:grid-cols-[minmax(240px,2.6fr)_minmax(90px,0.9fr)_minmax(180px,2fr)_minmax(180px,2fr)_minmax(100px,1fr)_132px] md:items-center md:gap-2">
                              <span className="flex min-w-0 items-center gap-2 truncate text-[13px] font-normal leading-5" title={conn.name}>
                                <Checkbox
                                  checked={selectedConnectionIds.has(conn.id)}
                                  onCheckedChange={(checked) => toggleConnectionSelection(conn.id, checked === true)}
                                  aria-label={`Select ${conn.name}`}
                                  className={selectedConnectionIds.size > 0 || selectedConnectionIds.has(conn.id)
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100 transition-opacity"}
                                />
                                <span className="truncate">{conn.name}</span>
                              </span>
                              <span className="truncate text-[13px] text-foreground/90 uppercase leading-5">{conn.type || '-'}</span>
                              <span className="truncate text-[13px] text-foreground/90 leading-5" title={`${conn.host || ''}${conn.instance ? `\\${conn.instance}` : ''}`}>
                                {conn.host || '-'}
                                {conn.instance ? `\\${conn.instance}` : ''}
                              </span>
                              <span className="truncate text-[13px] text-foreground/90 leading-5" title={conn.database || '-'}>{conn.database || '-'}</span>
                              <span className="text-[13px] text-foreground/90 leading-5">{formatCreatedAt(conn.created_at)}</span>
                              <div className="justify-self-end">{renderConnectionActions(conn)}</div>
                            </div>

                            <div className="md:hidden flex items-start justify-between gap-3 py-0">
                              <div className="min-w-0">
                                <div className="mb-0.5 flex items-center gap-2">
                                  {selectedConnectionIds.size > 0 && (
                                    <Checkbox
                                      checked={selectedConnectionIds.has(conn.id)}
                                      onCheckedChange={(checked) => toggleConnectionSelection(conn.id, checked === true)}
                                      aria-label={`Select ${conn.name}`}
                                    />
                                  )}
                                  <h4 className="truncate text-[13px] font-normal leading-5" title={conn.name}>{conn.name}</h4>
                                </div>
                                <p className="truncate text-[13px] text-foreground/90 leading-5" title={`${(conn.type || '').toUpperCase()} | ${conn.host || '-'}${conn.instance ? `\\${conn.instance}` : ''}`}>
                                  {(conn.type || '').toUpperCase()} | {conn.host || '-'}{conn.instance ? `\\${conn.instance}` : ''}
                                </p>
                              </div>
                              {renderConnectionActions(conn)}
                            </div>

                            {connectionId === conn.id && (
                              <div className="mt-2">{renderConnectionDetails(conn)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {filteredConnections.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {currentConnectionsPage} of {totalConnectionsPages}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={currentConnectionsPage <= 1}
                          onClick={() => setCurrentConnectionsPage((prev) => Math.max(1, prev - 1))}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        {connectionsPaginationItems.map((item, index) => (
                          typeof item === 'number' ? (
                            <Button
                              key={`page-${item}`}
                              variant={item === currentConnectionsPage ? 'default' : 'outline'}
                              size="sm"
                              className="h-8 min-w-8 px-2"
                              onClick={() => setCurrentConnectionsPage(item)}
                            >
                              {item}
                            </Button>
                          ) : (
                            <span key={`${item}-${index}`} className="px-1 text-muted-foreground">...</span>
                          )
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={currentConnectionsPage >= totalConnectionsPages}
                          onClick={() => setCurrentConnectionsPage((prev) => Math.min(totalConnectionsPages, prev + 1))}
                        >
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
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
                    <SelectItem value="azuresql">Azure SQL</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
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
                      value={
                        dbType === 'mssql' ? mssqlData.name :
                          dbType === 'azuresql' ? azureSqlData.name :
                            dbType === 'postgresql' ? postgresData.name :
                              dbType === 'mysql' ? mysqlData.name :
                                dbType === 'mariadb' ? mariadbData.name :
                                  dbType === 'oracle' ? oracleData.name :
                                    dbType === 'databricks' ? databricksData.name :
                                      dbType === 'snowflake' ? snowflakeData.name :
                                        dbType === 'redshift' ? redshiftData.name :
                                          dbType === 'sqlite' ? sqliteData.name : ''
                      }
                      onChange={(e) => {
                        const name = e.target.value;
                        if (dbType === 'mssql') setMssqlData({ ...mssqlData, name });
                        else if (dbType === 'azuresql') setAzureSqlData({ ...azureSqlData, name });
                        else if (dbType === 'postgresql') setPostgresData({ ...postgresData, name });
                        else if (dbType === 'mysql') setMysqlData({ ...mysqlData, name });
                        else if (dbType === 'mariadb') setMariadbData({ ...mariadbData, name });
                        else if (dbType === 'oracle') setOracleData({ ...oracleData, name });
                        else if (dbType === 'databricks') setDatabricksData({ ...databricksData, name });
                        else if (dbType === 'snowflake') setSnowflakeData({ ...snowflakeData, name });
                        else if (dbType === 'redshift') setRedshiftData({ ...redshiftData, name });
                        else if (dbType === 'sqlite') setSqliteData({ ...sqliteData, name });
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
                          : dbType === 'postgresql'
                            ? 'postgresql://user:password@localhost:5432/database'
                            : 'mysql://user:password@localhost:3306/database'
                      }
                    />
                  </div>

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
                                handleFetchDatabases(editingConnectionId);
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
                            <Label>Port {dbType === 'azuresql' ? <span className="text-destructive">*</span> : null}</Label>
                            <HelpTooltip content="Database port (default: 1433 for MSSQL)" />
                          </div>
                          <Input
                            value={dbType === 'mssql' ? mssqlData.port : azureSqlData.port}
                            onChange={(e) => dbType === 'mssql'
                              ? setMssqlData({ ...mssqlData, port: e.target.value })
                              : setAzureSqlData({ ...azureSqlData, port: e.target.value })
                            }
                            placeholder="1433"
                            required={dbType === 'azuresql'}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label>Instance</Label>
                          <HelpTooltip {...helpContent.connections.instance} />
                        </div>
                        <Input
                          value={dbType === 'mssql' ? mssqlData.instance : azureSqlData.instance}
                          onChange={(e) => dbType === 'mssql'
                            ? setMssqlData({ ...mssqlData, instance: e.target.value })
                            : setAzureSqlData({ ...azureSqlData, instance: e.target.value })
                          }
                          placeholder={dbType === 'mssql' ? "SQLEXPRESS" : "(Optional for Azure)"}
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
                      {dbType === 'mssql' && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label>Trusted Connection (Windows Auth)</Label>
                            <HelpTooltip {...helpContent.connections.trustedConnection} />
                          </div>
                          <Switch
                            checked={mssqlData.trustedConnection}
                            onCheckedChange={(checked) =>
                              setMssqlData({
                                ...mssqlData,
                                trustedConnection: checked,
                                username: checked ? '' : mssqlData.username,
                                password: checked ? '' : mssqlData.password,
                              })
                            }
                          />
                        </div>
                      )}
                      {!(dbType === 'mssql' && mssqlData.trustedConnection) && (
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
                            <div className="flex gap-2">
                              <Input
                                type={showSqlPassword ? 'text' : 'password'}
                                value={dbType === 'mssql' ? mssqlData.password : azureSqlData.password}
                                onChange={(e) => dbType === 'mssql'
                                  ? setMssqlData({ ...mssqlData, password: e.target.value })
                                  : setAzureSqlData({ ...azureSqlData, password: e.target.value })
                                }
                                placeholder="*******"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowSqlPassword(!showSqlPassword)}
                                aria-label={showSqlPassword ? 'Hide password' : 'View password'}
                              >
                                {showSqlPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
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
                                handleFetchDatabases(editingConnectionId);
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

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Connections</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {selectedConnectionIds.size} selected connection{selectedConnectionIds.size === 1 ? '' : 's'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkActionInProgress}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteConnections} disabled={bulkActionInProgress}>
              {bulkActionInProgress ? 'Deleting...' : 'Delete Selected'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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


