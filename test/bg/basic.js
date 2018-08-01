const fs = require('fs').promises
const util = require('util')

const glob = util.promisify(require('glob'))
const rc = require('rc')
const test = require('tape')

let settings = {}
rc('vialer-js', settings)

require('../../src/js/bg/vendor')
require('../../src/js/i18n/nl')


const {AppBackground, options} = require('../../src/js/bg')
// Load modules manually from settings.
const availabilityAddons = settings.brands.bologna.modules.builtin.availability.addons
const contactProviders = settings.brands.bologna.modules.builtin.contacts.providers
const userAdapter = settings.brands.bologna.modules.builtin.user.adapter
options.modules.builtin.find((i) => i.name === 'availability').addons = availabilityAddons
options.modules.builtin.find((i) => i.name === 'contacts').providers = contactProviders
options.modules.builtin.find((i) => i.name === 'user').adapter = userAdapter
options.modules.custom = settings.brands.bologna.modules.custom


test('[bg] starting up sequence', function(t) {
    t.plan(2)

    const bg = new AppBackground(options)
    // There is no schema in the database on a fresh start.
    t.equal(bg.store.get('schema'), null, 'storage: schema absent on startup')
    bg.on('factory-defaults', () => {
        // The schema is set after a factory reset.
        t.equal(bg.store.get('schema'), bg.store.schema, `storage: schema version (${bg.store.schema}) present after factory reset`)
    })
})


test('[bg] translations', async function(t) {
    t.plan(3)

    const files = await glob('{src/js/**/*.js,src/components/**/{*.vue,*.js}}')
    const translationMatch = /\$t\([\s]*'([a-zA-Z0-9_\s{}.,\\'!?%\-:;"]+)'[(\),)?]/g
    const unescape = /\\/g
    let missing = []
    let translations = []
    let faultyUppercase = []
    let redundant = []
    for (const filename of files) {
        const data = await (await fs.readFile(filename)).toString('utf8')
        data.replace(translationMatch, function(pattern, $t) {
            $t = $t.replace(unescape, '')
            // All translations must start with lower case.
            if (($t[0] !== $t[0].toLowerCase() && $t[1] !== $t[1].toUpperCase())) faultyUppercase.push($t)
            translations.push($t)
            if (!($t in global.translations.nl)) {
                missing.push($t)
            }
        })
    }

    // Check if we have translations that are not defined; i.e. that are redundant.
    for (const translation of Object.keys(global.translations.nl)) {
        if (!(translations.includes(translation))) {
            redundant.push(translation)
        }
    }

    t.notOk(faultyUppercase.length, 'translations are all lower-case')
    if (faultyUppercase.length) t.comment(`affected translations: \r\n${faultyUppercase.join('\r\n')}`)
    t.notOk(redundant.length, 'no redundant translations')
    if (redundant.length) t.comment(`affected translations: \r\n${redundant.join('\r\n')}`)
    t.notOk(missing.length, 'no missing translations')
    if (missing.length) t.comment(`affected translations: \r\n${missing.join('\r\n')}`)
})
