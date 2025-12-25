function evaluate(logic, inputs) {
    if (!logic || logic.length === 0) return 0;

    const firstBlock = logic[0] || {};
    if (firstBlock.type === 'special_case') {
        const weight = parseFloat(inputs.weight || 0);
        switch (firstBlock.id) {
            case 'TNK':
                if (weight < 60) return '6000unit (30mg / 6ml)';
                if (weight < 70) return '7000unit (35mg / 7ml)';
                if (weight < 80) return '8000unit (40mg / 8ml)';
                if (weight < 90) return '9000unit (45mg / 9ml)';
                return '10000unit (50mg / 10ml)';
            case 'LIDO_BOLUS':
                const desiredDose = parseFloat(inputs.desired_dose || 0);
                if (!weight || !desiredDose) return 'กรุณากรอกข้อมูล';
                const volume = (desiredDose * weight) / 20;
                return volume;
            default:
                return 'ไม่รู้จักสูตรพิเศษนี้';
        }
    }

    const conditionalBlock = logic.find(block => block.type === 'conditional');
    if (conditionalBlock) {
        for (const condition of conditionalBlock.conditions) {
            if (evaluate(condition.if, inputs)) {
                return evaluate(condition.then, inputs);
            }
        }
        if (conditionalBlock.else) {
            const elseLogic = Array.isArray(conditionalBlock.else) ? conditionalBlock.else : conditionalBlock.else.logic;
            return evaluate(elseLogic, inputs);
        }
        return 'เงื่อนไขไม่ตรง';
    }

    const stringBlock = logic.find(block => block.type === 'string');
    if (stringBlock && logic.length === 1) {
        return stringBlock.value;
    }

    let expression = logic.map(block => {
        switch (block.type) {
            case 'variable': return inputs[block.id] || 0;
            case 'constant': return block.value;
            case 'operator': return block.value;
            case 'parenthesis': return block.value;
            default: return '';
        }
    }).join(' ');

    try {
        return new Function(`return ${expression}`)();
    } catch (e) {
        console.error("Evaluation Error:", expression, e);
        return 'สูตรผิดพลาด';
    }
}

function mainEvaluate(logic, inputs, decimalPlaces) {
    if (!logic || logic.length === 0) {
        return null;
    }
    const result = evaluate(logic, inputs);

    if (typeof result === 'number' && !isNaN(result)) {
        const dp = (decimalPlaces !== null && decimalPlaces !== undefined) ? decimalPlaces : 2;
        return result.toFixed(dp);
    }
    return result;
}

module.exports = {
    evaluate: mainEvaluate
};