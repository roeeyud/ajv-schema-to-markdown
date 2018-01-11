const generateElementTitle = require('./generateElementTitle');
const generatePropertyRestrictions = require('./generatePropertyRestrictions');
const getActualType = require('./getActualType');

function getPrefixByDepth(depth) {
    let res = '';
    for(let i = 0; i < depth; i++) {
        res += '  ';
    }
    return res;
}
function generatePropertySection(depth, schema, subSchemas) {
    if (schema.properties) {
        return Object.keys(schema.properties).map((propertyKey) => {
            const propertyIsRequired = schema.required && schema.required.indexOf(propertyKey) >= 0;
            const prefix = getPrefixByDepth(depth);
            return generateSchemaSectionText(depth + 1, `${prefix}- `, propertyKey, propertyIsRequired, schema.properties[propertyKey], subSchemas);
        });
    } else if (schema.oneOf) {
        const oneOfList = schema.oneOf.map(innerSchema => `* \`${getActualType(innerSchema, subSchemas)}\``).join('\n');
        return ['This property must be one of the following types:', oneOfList];
    }
    return [];
}

function generateSchemaSectionText(
    depth, prefix, name,
    isRequired, schema, subSchemas,
) {
    const schemaType = getActualType(schema, subSchemas);

    let text = [
        generateElementTitle(prefix, name, schemaType, isRequired, schema.enum, schema.example),
        schema.description,
    ];

    if (schemaType === 'object') {
        if (schema.properties) {
            text.push(`Properties of the \`${name}\` object:`);
            generatePropertySection(depth + 1, prefix, schema, subSchemas)
                .forEach((section) => {
                    text = text.concat(section);
                });
        }
    } else if (schemaType === 'array') {
        let itemsType = schema.items && schema.items.type;

        if (!itemsType && schema.items.$ref) {
            itemsType = getActualType(schema.items, subSchemas);
        }

        if (itemsType && name) {
            text.push(`The object is an array with all elements of the type \`${itemsType}\`.`);
        } else if (itemsType) {
            text.push(`The schema defines an array with all elements of the type \`${itemsType}\`.`);
        } else {
            let validationItems = [];

            if (schema.items.allOf) {
                text.push('The elements of the array must match *all* of the following properties:');
                validationItems = schema.items.allOf;
            } else if (schema.items.anyOf) {
                text.push('The elements of the array must match *at least one* of the following properties:');
                validationItems = schema.items.anyOf;
            } else if (schema.items.oneOf) {
                text.push('The elements of the array must match *exactly one* of the following properties:');
                validationItems = schema.items.oneOf;
            } else if (schema.items.not) {
                text.push('The elements of the array must *not* match the following properties:');
                validationItems = schema.items.not;
            }

            if (validationItems.length > 0) {
                validationItems.forEach((item) => {
                    text = text.concat(generateSchemaSectionText(
                        depth + 1,
                        prefix,
                        undefined, false, item, subSchemas,
                    ));
                });
            }
        }

        if (itemsType === 'object') {
            text.push('The array object has the following properties:');
            generatePropertySection(depth + 1, prefix, schema.items, subSchemas).forEach((section) => {
                text = text.concat(section);
            });
        }
    } else if (schema.oneOf) {
        text.push('The object must be one of the following types:');
        text.push(schema.oneOf.map(oneOf => `* \`${subSchemas[oneOf.$ref]}\``).join('\n'));
    }

    if (schema.enum) {
        text.push('This element must be one of the following enum values:');
        text.push(schema.enum.map(enumItem => `* \`${enumItem}\``).join('\n'));
    }

    if (schema.default !== undefined) {
        if (schema.default === null || ['boolean', 'number', 'string'].indexOf(typeof schema.default) !== -1) {
            text.push(`Default: \`${JSON.stringify(schema.default)}\``);
        } else {
            text.push('Default:');
            text.push(`\`\`\`\n${JSON.stringify(schema.default, null, 2)}\n\`\`\``);
        }
    }

    const restrictions = generatePropertyRestrictions(schema);

    if (restrictions) {
        text.push('Additional restrictions:');
        text.push(restrictions);
    }

    return text;
};

module.exports = generatePropertySection;
