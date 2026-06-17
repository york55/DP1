-- ============================================================
-- OPS_AIRPORT - Carga inicial de aeropuertos
-- Fuente: PDDS 26-1 (basado en 2026.1) 20260404
-- ============================================================

INSERT IGNORE INTO OPS_AIRPORT (iata_code, name, country, short_code, continent, gmt_offset, capacity, latitude, longitude) VALUES
-- América del Sur
('SKBO', 'Bogota',            'Colombia',       'bogo', 'SOUTH_AMERICA',  -5, 430,   4.7014,  -74.1469),
('SEQM', 'Quito',             'Ecuador',        'quit', 'SOUTH_AMERICA',  -5, 410,   0.1133,  -78.3586),
('SVMI', 'Caracas',           'Venezuela',      'cara', 'SOUTH_AMERICA',  -4, 400,  10.6031,  -66.9906),
('SBBR', 'Brasilia',          'Brasil',         'bras', 'SOUTH_AMERICA',  -3, 480, -15.8647,  -47.9181),
('SPIM', 'Lima',              'Peru',           'lima', 'SOUTH_AMERICA',  -5, 440, -12.0219,  -77.1144),
('SLLP', 'La Paz',            'Bolivia',        'lapa', 'SOUTH_AMERICA',  -4, 420, -16.5131,  -68.1922),
('SCEL', 'Santiago de Chile', 'Chile',          'sant', 'SOUTH_AMERICA',  -3, 460, -33.3964,  -70.7947),
('SABE', 'Buenos Aires',      'Argentina',      'buen', 'SOUTH_AMERICA',  -3, 460, -34.5592,  -58.4156),
('SGAS', 'Asuncion',          'Paraguay',       'asun', 'SOUTH_AMERICA',  -4, 400, -25.2400,  -57.5200),
('SUAA', 'Montevideo',        'Uruguay',        'mont', 'SOUTH_AMERICA',  -3, 400, -34.7892,  -56.2647),

-- Europa
('LATI', 'Tirana',            'Albania',        'tira', 'EUROPE',         +2, 410,  41.4147,   19.7206),
('EDDI', 'Berlin',            'Alemania',       'berl', 'EUROPE',         +2, 480,  52.4736,   13.4017),
('LOWW', 'Viena',             'Austria',        'vien', 'EUROPE',         +2, 430,  48.1108,   16.5708),
('EBCI', 'Bruselas',          'Belgica',        'brus', 'EUROPE',         +2, 440,  50.4592,    4.4536),
('UMMS', 'Minsk',             'Bielorrusia',    'mins', 'EUROPE',         +3, 400,  53.8825,   28.0325),
('LBSF', 'Sofia',             'Bulgaria',       'sofi', 'EUROPE',         +3, 400,  42.6903,   23.4047),
('LKPR', 'Praga',             'Checa',          'prag', 'EUROPE',         +2, 400,  50.1014,   14.2656),
('LDZA', 'Zagreb',            'Croacia',        'zagr', 'EUROPE',         +2, 420,  45.7428,   16.0686),
('EKCH', 'Copenhague',        'Dinamarca',      'cope', 'EUROPE',         +2, 480,  55.6181,   12.6561),
('EHAM', 'Amsterdam',         'Holanda',        'amst', 'EUROPE',         +2, 480,  52.3000,    4.7650),

-- Asia
('VIDP', 'Delhi',             'India',          'delh', 'ASIA',           +5, 480,  28.5666,   77.1031),
('OSDI', 'Damasco',           'Siria',          'dama', 'ASIA',           +3, 400,  33.4114,   36.5156),
('OERK', 'Riad',              'Arabia Saudita', 'riad', 'ASIA',           +3, 420,  24.9578,   46.6989),
('OMDB', 'Dubai',             'Emiratos A.U.',  'emir', 'ASIA',           +4, 420,  25.2528,   55.3644),
('OAKB', 'Kabul',             'Afganistan',     'kabu', 'ASIA',           +4, 480,  34.5656,   69.2108),
('OOMS', 'Mascate',           'Oman',           'masc', 'ASIA',           +4, 460,  23.5928,   58.2842),
('OYSN', 'Sana',              'Yemen',          'sana', 'ASIA',           +3, 420,  15.4761,   44.2197),
('OPKC', 'Karachi',           'Pakistan',       'kara', 'ASIA',           +5, 410,  24.9000,   67.1500),
('UBBB', 'Baku',              'Azerbaiyan',     'baku', 'ASIA',           +2, 400,  40.4672,   50.0467),
('OJAI', 'Aman',              'Jordania',       'aman', 'ASIA',           +3, 400,  31.7225,   35.9933);