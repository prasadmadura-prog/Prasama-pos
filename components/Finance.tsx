
import React, { useState, useMemo } from 'react';
import { Transaction, BankAccount, DaySession, UserProfile, RecurringExpense, Product, Vendor } from '../types';

interface FinanceProps {
  transactions: Transaction[];
  accounts: BankAccount[];
  daySessions: DaySession[];
  products: Product[];
  vendors: Vendor[];
  recurringExpenses: RecurringExpense[];
  onOpenDay: (opening: number) => void;
  onCloseDay: (actual: number) => void;
  onAddExpense: (tx: Omit<Transaction, 'id' | 'date'>) => void;
  onAddTransfer: (tx: Omit<Transaction, 'id' | 'date'>) => void;
  onUpdateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddRecurring: (schedule: RecurringExpense) => void;
  onDeleteRecurring: (id: string) => void;
  onUpsertAccount: (acc: BankAccount) => void;
  userProfile: UserProfile;
}

const Finance: React.FC<FinanceProps> = ({ 
  transactions = [], 
  accounts = [], 
  daySessions = [], 
  products = [], 
  vendors = [],
  recurringExpenses = [], 
  onOpenDay, 
  onCloseDay, 
  onAddExpense, 
  onAddTransfer,
  onUpdateTransaction,
  onDeleteTransaction,
  onAddRecurring, 
  onDeleteRecurring, 
  onUpsertAccount,
  userProfile 
}) => {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  
  const [openingInput, setOpeningInput] = useState('');
  const [closingInput, setClosingInput] = useState('');
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', method: 'CASH' as 'CASH' | 'BANK', accountId: 'cash' });
  const [transferForm, setTransferForm] = useState({ sourceId: 'cash', destinationId: '', amount: '', description: 'INTERNAL FUND TRANSFER' });
  const [recurringForm, setRecurringForm] = useState({ description: '', amount: '', method: 'CASH' as 'CASH' | 'BANK', accountId: 'cash', frequency: 'MONTHLY' as any, startDate: new Date().toISOString().split('T')[0] });

  const currentSession = useMemo(() => {
    if (!Array.isArray(daySessions)) return undefined;
    return daySessions.find(s => s && s.date === reportDate);
  }, [daySessions, reportDate]);

  const dayTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    return transactions.filter(t => {
      if (!t || !t.date || typeof t.date !== 'string') return false;
      return t.date.split('T')[0] === reportDate;
    });
  }, [transactions, reportDate]);

  const expenseTransactions = useMemo(() => 
    dayTransactions.filter(t => t.type === 'EXPENSE').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  , [dayTransactions]);

  const transferTransactions = useMemo(() => 
    dayTransactions.filter(t => t.type === 'TRANSFER').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  , [dayTransactions]);

  const pendingCheques = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return transactions
      .filter(t => t.paymentMethod === 'CHEQUE' && t.chequeDate && t.chequeDate >= today)
      .sort((a, b) => (a.chequeDate || '').localeCompare(b.chequeDate || ''));
  }, [transactions]);

  const cashTransactions = useMemo(() => 
    dayTransactions.filter(t => t.paymentMethod === 'CASH' || (t.type === 'TRANSFER' && (t.accountId === 'cash' || t.destinationAccountId === 'cash')))
  , [dayTransactions]);
  
  const dayStats = useMemo(() => {
    const cashIn = cashTransactions
      .filter(t => t.type === 'SALE' || t.type === 'CREDIT_PAYMENT' || (t.type === 'TRANSFER' && t.destinationAccountId === 'cash'))
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    
    const cashOut = cashTransactions
      .filter(t => t.type === 'EXPENSE' || t.type === 'PURCHASE' || (t.type === 'TRANSFER' && t.accountId === 'cash'))
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      
    const opening = Number(currentSession?.openingBalance) || 0;
    const expectedCash = opening + cashIn - cashOut;
    
    return { cashIn, cashOut, expectedCash };
  }, [cashTransactions, currentSession]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) return;
    onAddExpense({ 
      type: 'EXPENSE', 
      amount: parseFloat(expenseForm.amount) || 0, 
      paymentMethod: expenseForm.method, 
      accountId: expenseForm.method === 'BANK' ? expenseForm.accountId : 'cash',
      description: expenseForm.description 
    });
    setExpenseForm({ description: '', amount: '', method: 'CASH', accountId: 'cash' });
  };

  const handleAddRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringForm.description || !recurringForm.amount) return;
    const schedule: RecurringExpense = {
      id: `REC-${Date.now()}`,
      description: recurringForm.description.toUpperCase(),
      amount: parseFloat(recurringForm.amount) || 0,
      paymentMethod: recurringForm.method,
      accountId: recurringForm.method === 'BANK' ? recurringForm.accountId : 'cash',
      frequency: recurringForm.frequency,
      startDate: recurringForm.startDate
    };
    onAddRecurring(schedule);
    setShowRecurringModal(false);
    setRecurringForm({ description: '', amount: '', method: 'CASH', accountId: 'cash', frequency: 'MONTHLY', startDate: new Date().toISOString().split('T')[0] });
  };

  const handleAddTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.sourceId || !transferForm.destinationId || !transferForm.amount) return;
    if (transferForm.sourceId === transferForm.destinationId) {
      alert("Source and destination accounts must be different.");
      return;
    }

    onAddTransfer({
      type: 'TRANSFER',
      amount: parseFloat(transferForm.amount) || 0,
      paymentMethod: 'BANK', 
      accountId: transferForm.sourceId,
      destinationAccountId: transferForm.destinationId,
      description: transferForm.description || 'INTERNAL FUND TRANSFER'
    });

    setTransferForm({ sourceId: 'cash', destinationId: '', amount: '', description: 'INTERNAL FUND TRANSFER' });
    setShowTransferModal(false);
  };

  const handleSaveAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const acc: BankAccount = {
      id: `acc-${Date.now()}`,
      name: fd.get('name') as string,
      accountNumber: fd.get('accountNumber') as string,
      balance: parseFloat(fd.get('balance') as string) || 0,
    };
    onUpsertAccount(acc);
    setShowAccountModal(false);
  };

  const getPayeeName = (tx: Transaction) => {
    if (tx.vendorId) return vendors.find(v => v.id === tx.vendorId)?.name || 'Unknown Vendor';
    return tx.description || 'General Item';
  };

  const getAccountName = (id?: string) => accounts.find(a => a.id === id)?.name || 'Unknown Account';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Finance Hub</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Strategy & Cash Control</p>
        </div>
        <div className="flex gap-4 items-center">
          <input type="date" className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10" value={reportDate} onChange={e => setReportDate(e.target.value)} />
          {!currentSession ? (
            <button onClick={() => setShowOpenModal(true)} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">☀️ Open Day</button>
          ) : currentSession.status === 'OPEN' ? (
            <button onClick={() => setShowCloseModal(true)} className="bg-rose-600 text-white px-10 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all">🌙 Close Day</button>
          ) : (
            <div className="bg-emerald-100 text-emerald-700 px-8 py-3 rounded-2xl font-black text-[10px] uppercase border border-emerald-200 text-center">✅ Day Audited</div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Asset Liquidity</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowTransferModal(true)} className="text-[9px] font-black text-emerald-600 uppercase border border-emerald-100 px-3 py-1 rounded-lg hover:bg-emerald-50 transition-all">⇄ Transfer</button>
                <button onClick={() => setShowAccountModal(true)} className="text-[9px] font-black text-indigo-600 uppercase border border-indigo-100 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-all">+ New Bank</button>
              </div>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex justify-between items-center p-5 rounded-3xl bg-slate-50 border border-slate-100 group transition-all">
                  <div className="min-w-0">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block truncate">{acc.name}</span>
                    <span className="text-[9px] font-bold text-slate-300 font-mono">{acc.accountNumber || 'SYSTEM LEDGER'}</span>
                  </div>
                  <span className="text-xl font-black font-mono text-slate-900 ml-4">Rs. {(Number(acc.balance) || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl">
             <div className="space-y-6">
                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em]">Audit Intelligence</p>
                <div className="space-y-1">
                   <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Expected In-Hand (Drawer)</p>
                   <p className="text-3xl font-black font-mono tracking-tighter text-white">Rs. {(dayStats.expectedCash || 0).toLocaleString()}</p>
                </div>
                <div className="border-t border-slate-800 pt-6 flex justify-between items-center">
                   <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Status</span>
                   <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] uppercase ${currentSession?.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{currentSession?.status || 'OFFLINE'}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">Expenditure Logging</h3>
            <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-8">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Description</label>
                <input required className="w-full px-6 py-4 rounded-2xl border border-slate-200 font-bold text-slate-800 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 outline-none uppercase" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value.toUpperCase()})} placeholder="E.G. ELECTRICITY BILL" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Amount (Rs.)</label>
                <input type="number" step="0.01" required className="w-full px-6 py-4 rounded-2xl border border-slate-200 font-black font-mono text-xl text-rose-600 focus:ring-4 focus:ring-rose-500/10 outline-none" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Payment Ledger</label>
                  <select className="w-full px-6 py-4 rounded-2xl border border-slate-200 font-black bg-white outline-none uppercase text-[11px]" value={expenseForm.method} onChange={e => setExpenseForm({...expenseForm, method: e.target.value as any})}>
                    <option value="CASH">Cash Drawer</option>
                    <option value="BANK">Bank Account</option>
                  </select>
                </div>
                {expenseForm.method === 'BANK' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Select Account</label>
                    <select className="w-full px-6 py-4 rounded-2xl border border-slate-200 font-black bg-white outline-none uppercase text-[11px]" value={expenseForm.accountId} onChange={e => setExpenseForm({...expenseForm, accountId: e.target.value})}>
                      {accounts.filter(a => a.id !== 'cash').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <button disabled={!currentSession || currentSession.status === 'CLOSED'} className="col-span-2 bg-slate-950 text-white font-black py-5 rounded-[1.5rem] uppercase text-xs tracking-[0.2em] hover:bg-black active:scale-[0.98] transition-all disabled:opacity-20 shadow-2xl">Authorize operational expense</button>
            </form>
          </div>
        </div>
      </div>

      {/* Daily Expense Ledger Section */}
      <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Daily Expense Ledger</h3>
            <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-4 py-1.5 rounded-full uppercase tracking-widest border border-rose-100">
               Total: Rs. {expenseTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0).toLocaleString()}
            </span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-400">
                    <tr>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Reference / Time</th>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Description</th>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Ledger</th>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Amount</th>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {expenseTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition-all group">
                            <td className="px-8 py-5">
                                <p className="text-[10px] font-black text-slate-900 uppercase font-mono">{tx.id.split('-').slice(-1)}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </td>
                            <td className="px-8 py-5">
                                <p className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{tx.description}</p>
                            </td>
                            <td className="px-8 py-5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-lg">{tx.paymentMethod}</span>
                                <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 truncate max-w-[120px]">{getAccountName(tx.accountId)}</p>
                            </td>
                            <td className="px-8 py-5 text-right font-black font-mono text-rose-600">
                                Rs. {(Number(tx.amount) || 0).toLocaleString()}
                            </td>
                            <td className="px-8 py-5 text-center">
                                <button onClick={() => onDeleteTransaction(tx.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 transition-all shadow-sm">🗑️</button>
                            </td>
                        </tr>
                    ))}
                    {expenseTransactions.length === 0 && (
                        <tr><td colSpan={5} className="px-8 py-16 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px] italic">No expenses logged for this session.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Recurring Subscriptions</h3>
                <button onClick={() => setShowRecurringModal(true)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">+ New Schedule</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-slate-400">
                        <tr>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Description</th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Freq</th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-right">Amount</th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {recurringExpenses.map(re => (
                            <tr key={re.id} className="hover:bg-slate-50 transition-all group">
                                <td className="px-6 py-5">
                                    <p className="text-[11px] font-black text-slate-900 uppercase">{re.description}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Via: {re.paymentMethod}</p>
                                </td>
                                <td className="px-6 py-5">
                                    <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{re.frequency}</span>
                                </td>
                                <td className="px-6 py-5 text-right font-black font-mono text-slate-900">
                                    Rs. {re.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <button onClick={() => onDeleteRecurring(re.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all">🗑️</button>
                                </td>
                            </tr>
                        ))}
                        {recurringExpenses.length === 0 && (
                            <tr><td colSpan={4} className="px-8 py-16 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No active recurring commitments.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Cheque Registry</h3>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upcoming Settlements</p>
                  <p className="text-lg font-black text-indigo-600 font-mono">{pendingCheques.length} Active</p>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-slate-400">
                        <tr>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Maturity Date</th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Payee / Detail</th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pendingCheques.map(tx => {
                          const today = new Date();
                          const maturityDate = new Date(tx.chequeDate!);
                          const diffTime = maturityDate.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          
                          return (
                            <tr key={tx.id} className="hover:bg-indigo-50/20 transition-all group">
                                <td className="px-6 py-5">
                                    <p className="font-black text-slate-900 text-xs">{tx.chequeDate}</p>
                                    <p className={`text-[9px] font-black uppercase ${diffDays <= 1 ? 'text-rose-500' : 'text-slate-400'}`}>
                                      {diffDays === 0 ? 'Matures Today' : diffDays === 1 ? 'Matures Tomorrow' : `In ${diffDays} Days`}
                                    </p>
                                </td>
                                <td className="px-6 py-5">
                                    <p className="text-xs font-black text-slate-700 uppercase tracking-tight truncate max-w-[150px]">{getPayeeName(tx)}</p>
                                    <p className="text-[9px] font-bold text-indigo-500 font-mono">CHQ# {tx.chequeNumber}</p>
                                </td>
                                <td className="px-6 py-5 text-right font-black font-mono text-slate-900">
                                    Rs. {Number(tx.amount).toLocaleString()}
                                </td>
                            </tr>
                          );
                        })}
                        {pendingCheques.length === 0 && (
                            <tr><td colSpan={3} className="px-8 py-16 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No pending cheques in registry.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {showRecurringModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
             <div className="p-10 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">New Recurring Commit</h3>
                <button onClick={() => setShowRecurringModal(false)} className="text-slate-300 hover:text-slate-950 text-3xl leading-none">&times;</button>
             </div>
             <form onSubmit={handleAddRecurring} className="p-10 space-y-6">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Label / Description</label>
                   <input required className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold uppercase" placeholder="E.G. OFFICE RENT" value={recurringForm.description} onChange={e => setRecurringForm({...recurringForm, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Frequency</label>
                    <select className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black text-[11px] bg-white uppercase" value={recurringForm.frequency} onChange={e => setRecurringForm({...recurringForm, frequency: e.target.value})}>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Start Date</label>
                    <input type="date" className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold" value={recurringForm.startDate} onChange={e => setRecurringForm({...recurringForm, startDate: e.target.value})} />
                  </div>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Amount (Rs.)</label>
                   <input type="number" step="0.01" required className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black font-mono text-xl text-indigo-600 outline-none" value={recurringForm.amount} onChange={e => setRecurringForm({...recurringForm, amount: e.target.value})} placeholder="0.00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Ledger</label>
                    <select className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black text-[11px] bg-white uppercase" value={recurringForm.method} onChange={e => setRecurringForm({...recurringForm, method: e.target.value as any})}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank</option>
                    </select>
                  </div>
                  {recurringForm.method === 'BANK' && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Account</label>
                      <select className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black text-[11px] bg-white uppercase" value={recurringForm.accountId} onChange={e => setRecurringForm({...recurringForm, accountId: e.target.value})}>
                        {accounts.filter(a => a.id !== 'cash').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <button type="submit" className="w-full bg-slate-950 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest text-[10px]">Create Automation</button>
             </form>
           </div>
        </div>
      )}

      {showAccountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
             <div className="p-10 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Register Bank</h3>
                <button onClick={() => setShowAccountModal(false)} className="text-slate-300 hover:text-slate-950 text-3xl leading-none">&times;</button>
             </div>
             <form onSubmit={handleSaveAccount} className="p-10 space-y-6">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Bank Name</label>
                   <input name="name" required className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold uppercase" placeholder="COMMERCIAL BANK" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Account Number</label>
                   <input name="accountNumber" className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black font-mono" placeholder="XXXX-XXXX-XXXX" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Opening Balance (Rs.)</label>
                   <input name="balance" type="number" step="0.01" required className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black font-mono text-xl text-indigo-600" placeholder="0.00" />
                </div>
                <button type="submit" className="w-full bg-slate-950 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest text-[10px]">Commit Records</button>
             </form>
           </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
             <div className="p-10 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Fund Movement</h3>
                <button onClick={() => setShowTransferModal(false)} className="text-slate-300 hover:text-slate-950 text-3xl leading-none">&times;</button>
             </div>
             <form onSubmit={handleAddTransfer} className="p-10 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Source Account</label>
                    <select className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black text-[11px] bg-white outline-none uppercase" value={transferForm.sourceId} onChange={e => setTransferForm({...transferForm, sourceId: e.target.value})}>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Destination Account</label>
                    <select className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black text-[11px] bg-white outline-none uppercase" value={transferForm.destinationId} onChange={e => setTransferForm({...transferForm, destinationId: e.target.value})}>
                      <option value="">Select Target</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Transfer Amount (Rs.)</label>
                   <input type="number" step="0.01" required className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-black font-mono text-xl text-emerald-600 outline-none focus:ring-4 focus:ring-emerald-500/10" value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Reference / Memo</label>
                   <input className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-xs uppercase" value={transferForm.description} onChange={e => setTransferForm({...transferForm, description: e.target.value.toUpperCase()})} placeholder="INTERNAL FUND TRANSFER" />
                </div>
                <button type="submit" disabled={!transferForm.destinationId || !transferForm.amount} className="w-full bg-slate-950 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest text-[10px] disabled:opacity-30">Authorize Fund Transfer</button>
             </form>
           </div>
        </div>
      )}

      {showOpenModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-12 text-center space-y-8 animate-in zoom-in duration-300">
              <div className="space-y-2">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Initialize Float</h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirm opening cash balance</p>
              </div>
              <input type="number" autoFocus className="w-full px-8 py-5 rounded-3xl border-2 border-slate-100 text-4xl font-black font-mono text-center text-indigo-600 outline-none focus:border-indigo-500 transition-all" placeholder="0.00" value={openingInput} onChange={e => setOpeningInput(e.target.value)} />
              <div className="flex gap-4">
                 <button onClick={() => setShowOpenModal(false)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-[11px] hover:text-slate-600 transition-colors">Cancel</button>
                 <button onClick={() => { onOpenDay(parseFloat(openingInput) || 0); setShowOpenModal(false); setOpeningInput(''); }} className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all">Start Day</button>
              </div>
           </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-12 text-center space-y-8 animate-in zoom-in duration-300">
              <div className="space-y-2">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Day End Count</h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verify physical cash in drawer</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center text-xs font-black text-slate-400 border border-slate-100">
                <span className="uppercase tracking-widest">Book Record</span>
                <span className="text-slate-900 font-mono text-sm">Rs. {(dayStats.expectedCash || 0).toLocaleString()}</span>
              </div>
              <input type="number" autoFocus className="w-full px-8 py-5 rounded-3xl border-2 border-slate-100 text-4xl font-black font-mono text-center text-rose-600 outline-none focus:border-rose-500 transition-all" placeholder="0.00" value={closingInput} onChange={e => setClosingInput(e.target.value)} />
              <div className="flex gap-4">
                 <button onClick={() => setShowCloseModal(false)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-[11px] hover:text-slate-600 transition-colors">Review</button>
                 <button onClick={() => { onCloseDay(parseFloat(closingInput) || 0); setShowCloseModal(false); setClosingInput(''); }} className="flex-[2] bg-rose-600 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all">Authorize Audit</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
