-- Add district_id column to the barangays table
ALTER TABLE public.barangays 
ADD COLUMN IF NOT EXISTS district_id INTEGER;

-- Add a comment for documentation
COMMENT ON COLUMN public.barangays.district_id IS 'CSWD District Cluster (1-6) as per CDRRMO preference';

-- Update District 1 (17 barangays)
UPDATE public.barangays SET district_id = 1 
WHERE name IN ('Bagong', 'Biliboy', 'Cabaon-an', 'Cabintan', 'Danao', 'Dayhagan', 'Dolores', 'Gaas', 'Liberty', 'Luna', 'Magaswi', 'Milagro', 'Nueva Vista', 'Salvacion', 'San Pablo', 'Santo Niño', 'Tongonan');

-- Update District 2 (18 barangays)
UPDATE public.barangays SET district_id = 2 
WHERE name IN ('Airport', 'Curva', 'Domonar', 'Esperanza', 'Green Valley', 'Lao', 'Leondoni', 'Libertad', 'Licuma', 'Liloan', 'Mabato', 'Manlilinao', 'Margen', 'Mas-in', 'Nueva Sociedad', 'Rufina M. Tan', 'San Juan', 'San Vicente');

-- Update District 3 (6 barangays)
UPDATE public.barangays SET district_id = 3 
WHERE name IN ('Alegria', 'Batuan', 'Linao', 'Naungan', 'Punta', 'Tambulilid');

-- Update District 4 (14 barangays)
UPDATE public.barangays SET district_id = 4 
WHERE name IN ('Bantigue', 'Borok', 'Camp Downes', 'Can-adieng', 'Can-untog', 'Danhug', 'Hugpa', 'Ipil', 'Mabini', 'Macabug', 'Mahayahay', 'Quezon Jr.', 'San Antonio', 'Sumangga');

-- Update District 5 (17 barangays)
UPDATE public.barangays SET district_id = 5 
WHERE name IN ('Bayog', 'Cabulihan', 'Cagbuhangin', 'Catmon', 'Concepcion', 'Don Potenciano Larrazabal', 'Guintigui-an', 'Hibunawon', 'Juaton', 'Kadaohan', 'Labrador', 'Matica-a', 'Monterico', 'Nasunogan', 'Sabang Bao', 'San Jose', 'Valencia');

-- Update District 6 (13 barangays)
UPDATE public.barangays SET district_id = 6 
WHERE name IN ('Alta Vista', 'Bagong Buhay', 'Cogon Combado', 'Don Felipe Larrazabal', 'Doña Feliza Z. Mejia', 'Donghol', 'Barangay East', 'Mahayag', 'Barangay North', 'Patag', 'San Isidro', 'Barangay South', 'Barangay West');

-- Verify the update (Optional: removes after verification)
-- SELECT name, district_id FROM public.barangays ORDER BY district_id, name;
