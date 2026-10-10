"""Installable read-only RAID connection preview. No claimed roster extraction."""
import argparse
import json
from pathlib import Path
import queue
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import webbrowser

from raid_probe import probe
from champion_memory import inspect_champion_samples

SITE = 'https://raid-companion.jtczy6pfmy.workers.dev/'


class ReaderWindow:
    def __init__(self, root):
        self.root = root
        self.result = None
        self.events = queue.Queue()
        root.title('RAID Companion — Windows Reader Preview')
        root.geometry('960x740')
        root.minsize(900, 640)
        root.configure(bg='#08090B')
        style = ttk.Style(root)
        style.theme_use('clam')
        style.configure('Treeview', background='#15171C', foreground='#F4F4F4', fieldbackground='#15171C', rowheight=28)
        style.configure('Treeview.Heading', background='#24262D', foreground='#FFB13B')
        tk.Label(root, text='RAID COMPANION', bg='#08090B', fg='#FF851B', font=('Segoe UI', 24, 'bold')).pack(anchor='w', padx=28, pady=(24, 2))
        tk.Label(root, text='Windows Reader Preview · 0.1.0', bg='#08090B', fg='#00DFF5', font=('Segoe UI', 12)).pack(anchor='w', padx=28)
        tk.Label(root, text='Experimental memory samples only. Verified roster/gear syncing and game automation are not available yet.',
                 wraplength=780, justify='left', bg='#08090B', fg='#FFB13B', font=('Segoe UI', 11)).pack(anchor='w', padx=28, pady=18)
        self.status = tk.StringVar(value='Open RAID through Plarium Play, then check the connection.')
        tk.Label(root, textvariable=self.status, wraplength=780, justify='left', bg='#08090B', fg='#F4F4F4', font=('Segoe UI', 12)).pack(anchor='w', padx=28, pady=(0, 14))
        table_frame = tk.Frame(root, bg='#08090B')
        table_frame.pack(fill='both', expand=True, padx=28)
        self.table = ttk.Treeview(table_frame, columns=('check', 'result'), show='headings', height=10)
        self.table.heading('check', text='Check')
        self.table.heading('result', text='Result')
        self.table.column('check', width=290)
        self.table.column('result', width=450)
        scrollbar = ttk.Scrollbar(table_frame, orient='vertical', command=self.table.yview)
        self.table.configure(yscrollcommand=scrollbar.set)
        self.table.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        buttons = tk.Frame(root, bg='#08090B')
        buttons.pack(fill='x', padx=28, pady=18)
        self.check_button = tk.Button(buttons, text='Check RAID connection', command=self.check, bg='#FF851B', fg='#08090B', padx=14, pady=9, font=('Segoe UI', 11, 'bold'))
        self.check_button.pack(side='left')
        self.sample_button = tk.Button(buttons, text='Inspect memory samples', command=lambda: self.check(samples=True), bg='#24262D', fg='#FFB13B', padx=10, pady=9)
        self.sample_button.pack(side='left', padx=(10, 0))
        self.export_button = tk.Button(buttons, text='Save diagnostic report', command=self.export, state='disabled', bg='#24262D', fg='#F4F4F4', padx=12, pady=9)
        self.export_button.pack(side='left', padx=12)
        tk.Button(buttons, text='Open web companion', command=lambda: webbrowser.open(SITE), bg='#24262D', fg='#00DFF5', padx=12, pady=9).pack(side='right')
        tk.Label(root, text='Read-only inspection. Samples may include old or non-player records; they are not imported into your roster.\nNothing is sent online. The web companion opens separately in your browser with its saved device session.',
                 justify='left', wraplength=780, bg='#08090B', fg='#AEB1BC', font=('Segoe UI', 10)).pack(anchor='w', padx=28, pady=(0, 24))
        root.after(100, self.poll)

    def check(self, samples=False):
        self.check_button.configure(state='disabled')
        self.sample_button.configure(state='disabled')
        self.status.set('Checking the running RAID process…')
        def work():
            try:
                result = inspect_champion_samples(progress=lambda text: self.events.put({'progress': text})) if samples else probe()
            except Exception as error:
                result = {'status': 'unavailable', 'champion_data_verified': False, 'reason': str(error)}
            self.events.put(result)
        threading.Thread(target=work, daemon=True).start()

    def poll(self):
        try:
            event = self.events.get_nowait()
            if 'progress' in event:
                self.status.set(event['progress'])
            else:
                self.display(event)
        except queue.Empty:
            pass
        self.root.after(100, self.poll)

    def display(self, result):
        self.result = result
        self.check_button.configure(state='normal')
        self.sample_button.configure(state='normal')
        self.export_button.configure(state='normal')
        self.table.delete(*self.table.get_children())
        verified = result.get('status') == 'memory_access_verified'
        if result.get('status') == 'memory_samples_read':
            self.status.set(f"Read {len(result['samples'])} experimental champion samples. Active roster membership and total stats are unverified.")
        elif verified:
            self.status.set('Read-only connection verified. Champion and gear extraction are not implemented yet.')
        elif result.get('windows_error') == 5:
            self.status.set('Windows denied memory access. Close this app and use “Run as administrator” to retry.')
        else:
            self.status.set(result.get('reason', 'Connection unavailable.'))
        self.table.insert('', 'end', values=('RAID process', 'Found' if result.get('process_id') else 'Not found'))
        for item in result.get('modules', []):
            self.table.insert('', 'end', values=(item['module'], 'Header verified' if item['header_read'] and item['valid_pe_signature'] else 'Not verified'))
        metadata = result.get('metadata')
        if metadata:
            self.table.insert('', 'end', values=('Installed metadata', f"Version {metadata['version']} · {'standard header' if metadata['standard_magic'] else 'unknown header'}"))
        self.table.insert('', 'end', values=('Champion / gear syncing', 'Not implemented'))
        for sample in result.get('samples', []):
            name = sample.get('name') or f"Champion type {sample['type_id']}"
            self.table.insert('', 'end', values=(f"{name} · copy {sample['id']}", f"Rank {sample['rank']} · Level {sample['level']} · Unverified roster membership"))

    def export(self):
        if not self.result:
            return
        target = filedialog.asksaveasfilename(parent=self.root, title='Save local diagnostic report', defaultextension='.json', initialfile='raid-connection-report.json', filetypes=[('JSON report', '*.json')])
        if target:
            try:
                Path(target).write_text(json.dumps(self.result, indent=2) + '\n', encoding='utf-8')
            except OSError as error:
                messagebox.showerror('Could not save report', str(error), parent=self.root)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    output = parser.add_mutually_exclusive_group()
    output.add_argument('--probe-output', type=Path)
    output.add_argument('--sample-output', type=Path)
    parser.add_argument('--smoke-test', action='store_true')
    args = parser.parse_args()
    if args.probe_output or args.sample_output:
        try:
            result = inspect_champion_samples() if args.sample_output else probe()
        except Exception as error:
            result = {'status': 'unavailable', 'champion_data_verified': False, 'reason': str(error)}
        (args.probe_output or args.sample_output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        sys.exit(0 if result['status'] in ('memory_access_verified', 'memory_samples_read') else 1)
    else:
        root = tk.Tk()
        window = ReaderWindow(root)
        if args.smoke_test:
            root.withdraw()
            root.update_idletasks()
            root.destroy()
        else:
            root.mainloop()
