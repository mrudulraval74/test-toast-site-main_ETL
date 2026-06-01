
-- ============================================================
-- WISPR Object Repository & UI Descriptor System
-- Phase 1: Core Schema
-- ============================================================

-- 1. Applications
CREATE TABLE public.or_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  app_type TEXT NOT NULL DEFAULT 'desktop' CHECK (app_type IN ('desktop', 'web', 'mobile')),
  technology_type TEXT NOT NULL DEFAULT 'UIA' CHECK (technology_type IN ('UIA', 'JAB', 'Web', 'Vision', 'Mobile')),
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

ALTER TABLE public.or_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view applications"
  ON public.or_applications FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can manage applications"
  ON public.or_applications FOR ALL TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- 2. Application Versions
CREATE TABLE public.or_app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.or_applications(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL DEFAULT '1.0.0',
  is_active BOOLEAN NOT NULL DEFAULT true,
  upgrade_compat_flag BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, version_label)
);

ALTER TABLE public.or_app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view versions"
  ON public.or_app_versions FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can manage versions"
  ON public.or_app_versions FOR ALL TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- 3. Screens
CREATE TABLE public.or_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.or_app_versions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  window_selector JSONB DEFAULT '{}',
  window_title_pattern TEXT,
  technology_type TEXT NOT NULL DEFAULT 'UIA' CHECK (technology_type IN ('UIA', 'JAB', 'Web', 'Vision', 'Mobile')),
  image_baseline_path TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.or_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view screens"
  ON public.or_screens FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can manage screens"
  ON public.or_screens FOR ALL TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- 4. Elements (core entity with immutable ID)
CREATE TABLE public.or_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES public.or_screens(id) ON DELETE CASCADE,
  parent_element_id UUID REFERENCES public.or_elements(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  element_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  element_type TEXT NOT NULL DEFAULT 'Button' CHECK (element_type IN (
    'Button', 'Edit', 'ComboBox', 'CheckBox', 'RadioButton', 'List', 'ListItem',
    'Tree', 'TreeItem', 'Tab', 'TabItem', 'Menu', 'MenuItem', 'DataGrid',
    'DataItem', 'Text', 'Image', 'Hyperlink', 'Window', 'Pane', 'Group', 'Custom'
  )),
  descriptor JSONB NOT NULL DEFAULT '{}',
  anchor_selector JSONB,
  image_region JSONB,
  screenshot_path TEXT,
  healing_metadata JSONB DEFAULT '{}',
  retry_count INT NOT NULL DEFAULT 3,
  timeout_ms INT NOT NULL DEFAULT 30000,
  failure_count INT NOT NULL DEFAULT 0,
  confidence_score NUMERIC(3,2) DEFAULT 1.00,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_version INT NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, element_uid)
);

ALTER TABLE public.or_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view elements"
  ON public.or_elements FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can manage elements"
  ON public.or_elements FOR ALL TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- 5. Element Version History
CREATE TABLE public.or_element_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id UUID NOT NULL REFERENCES public.or_elements(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  descriptor JSONB NOT NULL,
  anchor_selector JSONB,
  change_reason TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  confidence_score NUMERIC(3,2) DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'pending', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (element_id, version_number)
);

ALTER TABLE public.or_element_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view element versions"
  ON public.or_element_versions FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can manage element versions"
  ON public.or_element_versions FOR ALL TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- 6. UI Libraries
CREATE TABLE public.or_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  version_label TEXT NOT NULL DEFAULT '1.0.0',
  published_by UUID NOT NULL REFERENCES auth.users(id),
  source_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.or_libraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published libraries"
  ON public.or_libraries FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_project_member(source_project_id));

CREATE POLICY "Project members can manage libraries"
  ON public.or_libraries FOR ALL TO authenticated
  USING (public.is_project_member(source_project_id))
  WITH CHECK (public.is_project_member(source_project_id));

-- 7. Library-Application mapping
CREATE TABLE public.or_library_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.or_libraries(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.or_applications(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.or_app_versions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (library_id, application_id)
);

ALTER TABLE public.or_library_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view library apps"
  ON public.or_library_apps FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Library owners can manage"
  ON public.or_library_apps FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.or_libraries l
    WHERE l.id = library_id AND public.is_project_member(l.source_project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.or_libraries l
    WHERE l.id = library_id AND public.is_project_member(l.source_project_id)
  ));

-- 8. Project Dependencies
CREATE TABLE public.or_project_deps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES public.or_libraries(id) ON DELETE CASCADE,
  installed_version TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  installed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, library_id)
);

ALTER TABLE public.or_project_deps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view deps"
  ON public.or_project_deps FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can manage deps"
  ON public.or_project_deps FOR ALL TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- 9. Audit Log
CREATE TABLE public.or_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('application', 'version', 'screen', 'element', 'library', 'dependency')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'publish', 'install', 'heal', 'upgrade', 'migrate')),
  old_value JSONB,
  new_value JSONB,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.or_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audit log"
  ON public.or_audit_log FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can insert audit log"
  ON public.or_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id));

-- Indexes for performance
CREATE INDEX idx_or_applications_project ON public.or_applications(project_id);
CREATE INDEX idx_or_app_versions_app ON public.or_app_versions(application_id);
CREATE INDEX idx_or_screens_version ON public.or_screens(version_id);
CREATE INDEX idx_or_elements_screen ON public.or_elements(screen_id);
CREATE INDEX idx_or_elements_parent ON public.or_elements(parent_element_id);
CREATE INDEX idx_or_elements_uid ON public.or_elements(project_id, element_uid);
CREATE INDEX idx_or_element_versions_element ON public.or_element_versions(element_id);
CREATE INDEX idx_or_audit_log_entity ON public.or_audit_log(entity_type, entity_id);
CREATE INDEX idx_or_audit_log_project ON public.or_audit_log(project_id, created_at DESC);

-- Updated_at triggers
CREATE TRIGGER set_or_applications_updated_at
  BEFORE UPDATE ON public.or_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_or_app_versions_updated_at
  BEFORE UPDATE ON public.or_app_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_or_screens_updated_at
  BEFORE UPDATE ON public.or_screens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_or_elements_updated_at
  BEFORE UPDATE ON public.or_elements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_or_libraries_updated_at
  BEFORE UPDATE ON public.or_libraries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_or_project_deps_updated_at
  BEFORE UPDATE ON public.or_project_deps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate unique element UID
CREATE OR REPLACE FUNCTION public.generate_element_uid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.element_uid IS NULL OR NEW.element_uid = '' THEN
    NEW.element_uid := 'EL-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_or_element_uid
  BEFORE INSERT ON public.or_elements
  FOR EACH ROW EXECUTE FUNCTION public.generate_element_uid();
