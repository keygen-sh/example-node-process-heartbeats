# Example Process Heartbeats

This is an example of machine activation and process heartbeats. Machine
activation allows you to limit the number of devices used by a license,
while processes allow you to limit application concurrency. For example,
the `demo` credentials will allow up to 3 machine activations
and up to 3 concurrent processes across all machines.

## Running the example

First up, configure a few environment variables:

```bash
# Your Keygen account ID. Find yours at https://app.keygen.sh/settings.
export KEYGEN_ACCOUNT_ID="YOUR_KEYGEN_ACCOUNT_ID"
```

You can either run each line above within your terminal session before
starting the app, or you can add the above contents to your `~/.bashrc`
file and then run `source ~/.bashrc` after saving the file.

Next, install dependencies with [`yarn`](https://yarnpkg.comg):

```bash
yarn
```

## Activating a machine

To perform a machine activation, run the script and supply a valid
license key:

```bash
yarn start
```

If the license key is valid, the script will attempt to active the
current machine and then it will maintain process heartbeats,
until a `SIGINT` signal is sent to the process.

To use `demo` credentials, you can run the following:

```bash
KEYGEN_ACCOUNT_ID=demo yarn start
```

Enter `C1B6DE-39A6E3-DE1529-8559A0-4AF593-V3` when prompted.

## Questions?

Reach out at [support@keygen.sh](mailto:support@keygen.sh) if you have any
questions or concerns!
