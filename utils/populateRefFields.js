const mongoose = require('mongoose');

/**
 * Fetches a referenced document and embeds selected fields into a schema.
 *
 * @param {Object} options
 * @param {String} options.refField - The ObjectId reference field in the schema (e.g. 'make')
 * @param {String} options.embedField - The field to embed full object data into (e.g. 'makeInfo')
 * @param {String} options.modelName - The name of the referenced model (e.g. 'vehiclemake')
 * @param {String[]} [options.fields] - The fields to embed from the referenced model (optional, defaults to ['_id'])
 */
function populateRefFields({ refField, embedField, modelName, fields = ['_id'] }) {

    // Save hook (for create/save)
    async function setInDoc(doc) {
        if (!doc.isModified(refField) && !doc.isNew) return;

        const RefModel = mongoose.model(modelName);
        console.log('refModel: ', RefModel);
        const refId = doc[refField];
        const refDoc = await RefModel.findById(refId).lean();
        console.log('refDoc: ', refDoc);
        if (refDoc) {
            doc[embedField] = pickFields(refDoc, fields);
            console.log(doc[embedField]);
        }
    }

    // Update hook (for update queries)
    async function setInUpdate(context) {
        const update = context.getUpdate();
        if (!update || !update[refField]) return;

        const RefModel = mongoose.model(modelName);
        const refDoc = await RefModel.findById(update[refField]).lean();
        if (refDoc) {
            update[embedField] = pickFields(refDoc, fields);
            context.setUpdate(update);
        }
    }

    return {
        applyTo(schema) {
            schema.pre('save', function () {
                return setInDoc(this);
            });

            ['findOneAndUpdate', 'updateOne', 'updateMany'].forEach(method => {
                schema.pre(method, async function (next) {
                    try {
                        await setInUpdate(this);
                        next();
                    } catch (err) {
                        next(err);
                    }
                });
            });
        }
    };
}

// Helper to extract selected fields
function pickFields(source, fields) {
    const result = {};
    for (const field of fields) {
        result[field] = source[field];
    }
    console.log('result: ', result);
    return result;
}

module.exports = populateRefFields;
