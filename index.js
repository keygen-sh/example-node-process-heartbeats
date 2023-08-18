const { DEBUG, KEYGEN_ACCOUNT_ID } = process.env
if (!KEYGEN_ACCOUNT_ID) {
  throw Error('Environment variable KEYGEN_ACCOUNT_ID is required')
}

const { machineId } = require('node-machine-id')
const fetch = require('node-fetch')
const readline = require('readline')
const chalk = require('chalk')

const rl = readline.createInterface(
  process.stdin,
  process.stdout,
)

const prompt = msg =>
  new Promise(resolve => rl.question(chalk.cyan(`${msg}: `), resolve))

async function activateMachine(fingerprint, { key } = {}) {
  // Validate the license key before activation, so we can be sure it supports
  // another machine. Notice that this validation is scoped to the current
  // machine via its fingerprint - this ensures that license activation is
  // not performed for machines that are already activated.
  const validation = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/licenses/actions/validate-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      meta: {
        scope: { fingerprint },
        key,
      }
    })
  })

  const { meta, errors, data: license } = await validation.json()
  if (errors) {
    throw new Error(JSON.stringify(errors, null, 2))
  }

  // If the license is valid, that means the current machine is already
  // activated. We can safely return.
  if (meta.valid) {
    const machine = await retrieveMachine(fingerprint, { key })

    return machine
  }

  // If we've gotten this far, our license is not valid for the current
  // machine and we should attempt to activate it.
  switch (meta.code) {
    // This means the license already has at least 1 machine associated with
    // it, but none match the current machine's fingerprint. We're breaking
    // on this case because, for this example, we want to support activating
    // more than 1 machine.
    case 'FINGERPRINT_SCOPE_MISMATCH':
    // You will receive a NO_MACHINES status when the license IS floating,
    // and it does not currently have any associated machines.
    case 'NO_MACHINES':
    // You will receive a NO_MACHINE status when the license IS NOT floating
    // i.e. it's node-locked, and it does not currently have any
    // associated machines.
    case 'NO_MACHINE': {
      break
    }
    default: {
      throw new Error(`license ${meta.detail} (${meta.code})`)
    }
  }

  // Attempt to activate the current machine for the license, using the
  // license ID that we received from the validation response and the
  // current machine's fingerprint.
  const activation = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/machines`, {
    method: 'POST',
    headers: {
      'Authorization': `License ${key}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'machines',
        attributes: {
          fingerprint
        },
        relationships: {
          license: {
            data: { type: 'licenses', id: license.id }
          }
        }
      }
    })
  })

  const { data: machine, errors: errs } = await activation.json()
  if (errs) {
    throw new Error(JSON.stringify(errs, null, 2))
  }

  // All is good - the machine was successfully activated.
  return machine
}

async function deactivateMachine(id, { key } = {}) {
  const deactivation = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/machines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `License ${key}`,
      'Accept': 'application/vnd.api+json',
    }
  })

  if (deactivation.status === 204) {
    return
  }

  const { errors } = await deactivation.json()
  if (errors) {
    throw new Error(JSON.stringify(errors, null, 2))
  }
}

async function retrieveMachine(id, { key } = {}) {
  const retrieval = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/machines/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      'Authorization': `License ${key}`,
      'Accept': 'application/vnd.api+json',
    }
  })

  const { data: machine, errors } = await retrieval.json()
  if (errors) {
    throw new Error(JSON.stringify(errors, null, 2))
  }

  return machine
}

async function spawnProcess(pid, { machine, key } = {}) {
  const spawn = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/processes`, {
    method: 'POST',
    headers: {
      'Authorization': `License ${key}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'processes',
        attributes: {
          pid
        },
        relationships: {
          machine: {
            data: { type: 'machines', id: machine.id }
          }
        }
      }
    })
  })

  const { data: process, errors } = await spawn.json()
  if (errors) {
    throw new Error(JSON.stringify(errors, null, 2))
  }

  return process
}

async function killProcess(id, { key } = {}) {
  const kill = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/processes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `License ${key}`,
      'Accept': 'application/vnd.api+json',
    }
  })

  if (kill.status === 204) {
    return
  }

  const { errors } = await kill.json()
  if (errors) {
    throw new Error(JSON.stringify(errors, null, 2))
  }
}

function monitorProcess(id, { frequency, key } = {}) {
  console.log(
    chalk.yellow(`Heartbeat monitor started... (process ${id})`)
  )

  const interval = setInterval(async () => {
    await pingProcess(id, { key }) // Send pings on an interval

    console.log(
      chalk.green(`Heartbeat ping successfully sent (process ${id})`)
    )
  }, (frequency - 30) * 1000)

  return () => {
    console.log(
      chalk.yellow(`Heartbeat monitor stopping... (process ${id})`)
    )

    clearInterval(interval)
  }
}

async function pingProcess(id, { key } = {}) {
  const ping = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/processes/${encodeURIComponent(id)}/actions/ping`, {
    method: 'POST',
    headers: {
      'Authorization': `License ${key}`,
      'Accept': 'application/vnd.api+json',
    }
  })

  const { data: process, errors } = await ping.json()
  if (errors) {
    throw new Error(JSON.stringify(errors, null, 2))
  }

  return process
}

async function main() {
  const key = await prompt('Enter a license key')
  const fingerprint = await machineId()
  const pid = process.pid.toString()

  try {
    const machine = await activateMachine(fingerprint, { key })
    console.log(
      chalk.green(`Machine successfully activated (machine ${machine.id})`)
    )

    const proc = await spawnProcess(pid, { machine, key })
    console.log(
      chalk.green(`Process successfully spawned (process ${proc.id})`)
    )

    // Maintain heartbeat
    const cancel = monitorProcess(proc.id, {
      frequency: proc.attributes.interval,
      key,
    })

    // Kill process on process exit
    process.on('SIGINT', async () => {
      await killProcess(proc.id, { key })
      cancel()

      console.log(
        chalk.yellow(`Process successfully killed (process ${proc.id})`)
      )

      console.log(
        chalk.yellow('Exiting...')
      )

      process.exit(0)
    })
  } catch (e) {
    console.error(
      chalk.red(`An error has occurred:\n${e.message}`)
    )

    if (DEBUG) {
      console.error(e)
    }

    process.exit(1)
  }
}

main()
