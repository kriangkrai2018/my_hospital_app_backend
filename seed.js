const pool = require('./config/config');

// ข้อมูลสูตรยามาตรฐาน อัปเดตล่าสุดตามต้นฉบับ
const standardFormulas = [
    {
        name: 'Levophed 8:250',
        description: '8mg in 250ml for mcg/kg/min calculation.',
        result_unit: 'mcg/kg/min',
        decimal_places: 3,
        icon_class: 'fas fa-heartbeat',
        visibility: 'public',
        inputs: [
            { id: 'rate', display_name: 'Rate', unit: 'ml/hr', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'rate' },
            { id: 'max_dose', display_name: 'Max Dose', unit: 'mcg/kg/min', logic_type: 'rate' }
        ],
        dose_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'rate' }, { type: 'operator', value: '*' }, { type: 'constant', value: 32 }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '/' }, { type: 'constant', value: 60 } ],
        rate_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '*' }, { type: 'constant', value: 60 }, { type: 'operator', value: '*' }, { type: 'variable', id: 'max_dose' }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'constant', value: 32 } ]
    },
    {
        name: 'Levophed 8:100',
        description: '8mg in 100ml for mcg/kg/min calculation.',
        result_unit: 'mcg/kg/min',
        decimal_places: 2,
        icon_class: 'fas fa-heart-pulse',
        visibility: 'public',
        inputs: [
            { id: 'rate', display_name: 'Rate', unit: 'ml/hr', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'rate' },
            { id: 'max_dose', display_name: 'Max Dose', unit: 'mcg/kg/min', logic_type: 'rate' }
        ],
        dose_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'rate' }, { type: 'operator', value: '*' }, { type: 'constant', value: 80 }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '/' }, { type: 'constant', value: 60 } ],
        rate_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '*' }, { type: 'constant', value: 60 }, { type: 'operator', value: '*' }, { type: 'variable', id: 'max_dose' }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'constant', value: 80 } ]
    },
    {
        name: 'Dopamine 2:1',
        description: '200mg in 100ml for mcg/kg/min calculation.',
        result_unit: 'mcg/kg/min',
        decimal_places: 2,
        icon_class: 'fas fa-bolt',
        visibility: 'public',
        inputs: [
            { id: 'rate', display_name: 'Rate', unit: 'ml/hr', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'rate' },
            { id: 'max_dose', display_name: 'Max Dose', unit: 'mcg/kg/min', logic_type: 'rate' }
        ],
        dose_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'rate' }, { type: 'operator', value: '*' }, { type: 'constant', value: 2000 }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '/' }, { type: 'constant', value: 60 } ],
        rate_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '*' }, { type: 'constant', value: 60 }, { type: 'operator', value: '*' }, { type: 'variable', id: 'max_dose' }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'constant', value: 2000 } ]
    },
    {
        name: 'Dobutamine',
        description: '200mg in 100ml for mcg/kg/min calculation.',
        result_unit: 'mcg/kg/min',
        decimal_places: 2,
        icon_class: 'fas fa-lungs',
        visibility: 'public',
        inputs: [
            { id: 'rate', display_name: 'Rate', unit: 'ml/hr', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'dose' },
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'rate' },
            { id: 'max_dose', display_name: 'Max Dose', unit: 'mcg/kg/min', logic_type: 'rate' }
        ],
        dose_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'rate' }, { type: 'operator', value: '*' }, { type: 'constant', value: 2000 }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '/' }, { type: 'constant', value: 60 } ],
        rate_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'weight' }, { type: 'operator', value: '*' }, { type: 'constant', value: 60 }, { type: 'operator', value: '*' }, { type: 'variable', id: 'max_dose' }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'constant', value: 2000 } ]
    },
    {
        name: 'Nitroglycerin 1:5',
        description: '20mg in 100ml for mcg/min calculation.',
        result_unit: 'mcg/min',
        decimal_places: 2,
        icon_class: 'fas fa-vial',
        visibility: 'public',
        inputs: [
            { id: 'rate', display_name: 'Rate', unit: 'ml/hr', logic_type: 'dose' },
            { id: 'max_dose', display_name: 'Max Dose', unit: 'mcg/min', logic_type: 'rate' }
        ],
        dose_logic: [ { type: 'parenthesis', value: '(' }, { type: 'variable', id: 'rate' }, { type: 'operator', value: '*' }, { type: 'constant', value: 200 }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'constant', value: 60 } ],
        rate_logic: [ { type: 'parenthesis', value: '(' }, { type: 'constant', value: 60 }, { type: 'operator', value: '*' }, { type: 'variable', id: 'max_dose' }, { type: 'parenthesis', value: ')' }, { type: 'operator', value: '/' }, { type: 'constant', value: 200 } ]
    },
    {
        name: 'Tenecteplase (TNK)',
        description: 'ให้ยาตามตารางเทียบน้ำหนัก',
        result_unit: '',
        decimal_places: null,
        icon_class: 'fas fa-brain',
        visibility: 'public',
        inputs: [ { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'dose' } ],
        dose_logic: [ { type: 'special_case', id: 'TNK' } ]
    },
    {
        name: 'Lidocaine (Bolus)',
        description: 'คำนวณหาปริมาตรยา (ml) ที่ต้องใช้',
        result_unit: 'ml',
        decimal_places: 2,
        icon_class: 'fas fa-syringe',
        visibility: 'public',
        inputs: [
            { id: 'weight', display_name: 'น้ำหนักตัว', unit: 'kg', logic_type: 'dose' },
            { id: 'desired_dose', display_name: 'Dose ที่ต้องการ', unit: 'mg/kg', logic_type: 'dose' }
        ],
        dose_logic: [ { type: 'special_case', id: 'LIDO_BOLUS' } ]
    }
];

async function seedDatabase() {
    const connection = await pool.promise().getConnection();
    try {
        await connection.beginTransaction();
        console.log('Clearing old public formulas...');
        const [publicFormulas] = await connection.query("SELECT id FROM formulas WHERE visibility = 'public'");
        if (publicFormulas.length > 0) {
            const idsToDelete = publicFormulas.map(f => f.id);
            await connection.query("DELETE FROM formula_inputs WHERE formula_id IN (?)", [idsToDelete]);
            await connection.query("DELETE FROM formula_logic WHERE formula_id IN (?)", [idsToDelete]);
            await connection.query("DELETE FROM formulas WHERE id IN (?)", [idsToDelete]);
        }

        console.log('Starting to seed new database with all formulas...');
        for (const formula of standardFormulas) {
            const [formulaResult] = await connection.query(
                'INSERT INTO formulas (name, description, result_unit, decimal_places, icon_class, visibility, created_by) VALUES (?, ?, ?, ?, ?, ?, NULL)',
                [formula.name, formula.description, formula.result_unit, formula.decimal_places, formula.icon_class, formula.visibility]
            );
            const newFormulaId = formulaResult.insertId;

            if (formula.inputs && formula.inputs.length > 0) {
                const uniqueInputs = new Map();
                formula.inputs.forEach(v => {
                    const key = `${v.id}-${v.logic_type}`;
                    if (!uniqueInputs.has(key)) {
                        uniqueInputs.set(key, [newFormulaId, v.id, v.display_name, v.unit, v.logic_type]);
                    }
                });
                const inputValues = Array.from(uniqueInputs.values());
                if(inputValues.length > 0) {
                    await connection.query('INSERT INTO formula_inputs (formula_id, variable_name, display_name, unit, logic_type) VALUES ?', [inputValues]);
                }
            }
            if (formula.dose_logic) {
                await connection.query('INSERT INTO formula_logic (formula_id, logic_definition, type) VALUES (?, ?, ?)', [newFormulaId, JSON.stringify(formula.dose_logic), 'dose']);
            }
            if (formula.rate_logic) {
                 await connection.query('INSERT INTO formula_logic (formula_id, logic_definition, type) VALUES (?, ?, ?)', [newFormulaId, JSON.stringify(formula.rate_logic), 'rate']);
            }
        }
        await connection.commit();
        console.log('Database has been seeded successfully with updated formulas!');
    } catch (err) {
        await connection.rollback();
        console.error('Error seeding database:', err);
    } finally {
        connection.release();
        pool.end();
    }
}

seedDatabase();