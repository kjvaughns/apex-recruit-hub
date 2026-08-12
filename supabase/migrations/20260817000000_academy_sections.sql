-- PR6: Academy hub — split library resources into Recorded Presentations vs
-- Library, and replace the tag-chip system with simple optional categories.

ALTER TABLE public.library_resources
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'library',
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.library_resources.section IS
  'Which Academy hub section this belongs to: library or presentation.';
COMMENT ON COLUMN public.library_resources.category IS
  'Optional simple folder/category for the Library (e.g. Scripts, Systems, Carrier Resources).';

-- Recorded trainings were folded into the library tagged "Recorded Training";
-- promote those into the Recorded Presentations section.
UPDATE public.library_resources r
  SET section = 'presentation'
  WHERE section = 'library'
    AND EXISTS (
      SELECT 1
      FROM public.library_resource_tags rt
      JOIN public.library_tags t ON t.id = rt.tag_id
      WHERE rt.resource_id = r.id AND lower(t.name) = 'recorded training'
    );
