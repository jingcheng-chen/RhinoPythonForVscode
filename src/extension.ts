'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
// init an outputchannel
const outputChannel = vscode.window.createOutputChannel('RhinoPython');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // send the messgage to Rhino
  let isRunning = false;

  const portNumber = 614;

  function SendToRhino(messgage: string) {
    const client = net.connect({ port: portNumber }, () => {
      isRunning = true;
      client.write(messgage);
    });

    client.on('connect', function () {
      outputChannel.show(true);
      outputChannel.clear();
      outputChannel.appendLine(`====== ${new Date().toLocaleString()} ======`);
    });

    client.on('data', function (data: any) {
      const info: string = data.toString();
      outputChannel.append(info);
      client.end();
    });

    // Add a 'close' event handler for the client socket
    client.on('end', function () {
      isRunning = false;
      console.log('Rhino disconnected.');
    });

    client.on('error', function (err: any) {
      if (err.code === 'ECONNREFUSED') {
        vscode.window.showWarningMessage('Cannot connect Rhino. Please make sure Rhino is running CodeListener.');
      } else if (err.code === 'EISCONN') {
        vscode.window.showWarningMessage('Cannot send code. An existing code is still running.');
      } else {
        vscode.window.showWarningMessage(err.toString());
      }
      isRunning = false;
      client.end();
    });
  }

  // register execute command
  let disposable = vscode.commands.registerCommand('extension.CodeSender', async () => {
    // check if rhino python is enabled by the user
    if (!vscode.workspace.getConfiguration('RhinoPython').Enabled) {
      return;
    }
    if (isRunning) {
      vscode.window.showWarningMessage('Cannot send code. An existing code is still running.');
      return;
    }
    // check if editor is open
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No code detected.');
      return;
    } else {
      const text = editor.document.getText();

      if (!text) {
        vscode.window.showWarningMessage('No code detected.');
        return;
      }

      // initialize filesystem, operation system, and socket

      // check if reset engine
      const reset = vscode.workspace.getConfiguration('RhinoPython').ResetAndRun;

      // check if it is temp file, if yes then save to a temp file
      const temp = editor.document.isUntitled;
      const run = true;
      if (temp) {
        const tmpfolder = os.tmpdir();
        const filename = tmpfolder + '\\TempScript.py';
        fs.writeFileSync(filename, text);
        const msgObject = JSON.stringify({ reset, temp, filename, run });
        SendToRhino(msgObject);
      } else {
        const filename = editor.document.fileName;
        const msgObject = JSON.stringify({ reset, temp, filename, run });
        await editor.document.save();
        SendToRhino(msgObject);
      }
    }
  });

  context.subscriptions.push(disposable);

  // register reset command
  disposable = vscode.commands.registerCommand('extension.CodeSenderReset', () => {
    const run = false;
    const filename = '';
    const temp = true;
    const reset = true;
    const msgObject = JSON.stringify({ reset, temp, filename, run });
    SendToRhino(msgObject);
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
  outputChannel.hide();
  outputChannel.dispose();
}
