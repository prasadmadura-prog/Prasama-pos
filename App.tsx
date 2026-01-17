
import React, { useState, useEffect, useRef } from 'react';
import { View, Product, Transaction, BankAccount, PurchaseOrder, Vendor, Customer, UserProfile, Category, RecurringExpense, DaySession } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Purchases from './components/Purchases';
import Finance from './components/Finance';
import Customers from './components/Customers';
import ChequePrint from './components/ChequePrint';
import BarcodePrint from './components/BarcodePrint';
import SalesHistory from './components/SalesHistory';
import Settings from './components/Settings';
import { loadCloudData, saveCloudData } from './services/database';

const PERSISTENCE_KEY = 'prasama_erp_production_v5';

const INITIAL_DATA = {
  "version": "5.0",
  "userProfile": {
    "name": "PRASAMA(PVT)LTD",
    "branch": "No 16,Kirulapana Supermarket, Colombo 05",
    "logo": ""
  },
  "products": [],
  "categories": [],
  "transactions": [],
  "accounts": [
    { "id": "cash", "name": "Main Cash Drawer", "balance": 0 },
    { "id": "bank_default", "name": "Commercial Bank", "balance": 0 }
  ],
  "purchaseOrders": [],
  "vendors": [],
  "customers": []
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
  
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [products, setProducts] = useState<Product[]>(INITIAL_DATA.products);
  const [categories, setCategories] = useState<Category[]>(INITIAL_DATA.categories);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_DATA.transactions);
  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_DATA.accounts);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_DATA.purchaseOrders);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_DATA.vendors);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_DATA.customers);
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_DATA.userProfile);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [daySessions, setDaySessions] = useState<DaySession[]>([]);
  const [posSession, setPosSession] = useState({ cart: [], discount: 0, discountPercent: 0, paymentMethod: 'CASH', accountId: 'cash', search: '' });

  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const initData = async () => {
      const cloudData = await loadCloudData();
      const local = localStorage.getItem(PERSISTENCE_KEY);
      const parsedLocal = local ? JSON.parse(local) : null;
      
      const source = (parsedLocal && parsedLocal.products && parsedLocal.products.length > 0) 
        ? parsedLocal 
        : cloudData || INITIAL_DATA;

      if (source) {
        if (Array.isArray(source.products)) setProducts(source.products);
        if (Array.isArray(source.categories)) setCategories(source.categories);
        if (Array.isArray(source.transactions)) setTransactions(source.transactions);
        if (Array.isArray(source.accounts)) setAccounts(source.accounts);
        if (Array.isArray(source.purchaseOrders)) setPurchaseOrders(source.purchaseOrders);
        if (Array.isArray(source.vendors)) setVendors(source.vendors);
        if (Array.isArray(source.customers)) setCustomers(source.customers);
        if (source.userProfile) setUserProfile(source.userProfile);
        if (Array.isArray(source.recurringExpenses)) setRecurringExpenses(source.recurringExpenses);
        if (Array.isArray(source.daySessions)) setDaySessions(source.daySessions);
        if (source.posSession) setPosSession(source.posSession);
      }
      setIsLoading(false);
    };
    initData();
  }, []);

  // Recurring Expense Automation Engine
  useEffect(() => {
    if (isLoading || recurringExpenses.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let hasChanges = false;
    const newTransactions: any[] = [];
    const updatedSchedules = recurringExpenses.map(schedule => {
      const lastRun = schedule.lastProcessedDate ? new Date(schedule.lastProcessedDate) : new Date(schedule.startDate);
      lastRun.setHours(0, 0, 0, 0);
      
      let isDue = false;
      const daysSinceLastRun = Math.floor((today.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24));

      if (schedule.frequency === 'DAILY' && daysSinceLastRun >= 1) isDue = true;
      if (schedule.frequency === 'WEEKLY' && daysSinceLastRun >= 7) isDue = true;
      if (schedule.frequency === 'MONTHLY' && daysSinceLastRun >= 30) isDue = true;

      if (isDue) {
        hasChanges = true;
        const txId = `RECUR-${schedule.id}-${todayStr}`;
        // Prevent duplicate processing if it already exists for today
        if (!transactions.some(t => t.id === txId)) {
          newTransactions.push({
            id: txId,
            type: 'EXPENSE',
            amount: schedule.amount,
            description: `[RECURRING] ${schedule.description}`,
            paymentMethod: schedule.paymentMethod,
            accountId: schedule.accountId || (schedule.paymentMethod === 'CASH' ? 'cash' : 'bank_default'),
            date: today.toISOString()
          });
          return { ...schedule, lastProcessedDate: today.toISOString() };
        }
      }
      return schedule;
    });

    if (hasChanges && newTransactions.length > 0) {
      newTransactions.forEach(tx => addTransaction(tx));
      setRecurringExpenses(updatedSchedules);
    }
  }, [isLoading, recurringExpenses.length]);

  useEffect(() => {
    if (isLoading) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(async () => {
      setSyncStatus('SYNCING');
      const dataToSave = { 
        products, categories, transactions, accounts, purchaseOrders, vendors, customers, userProfile, recurringExpenses, posSession, daySessions 
      };
      localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(dataToSave));
      const success = await saveCloudData(dataToSave);
      setSyncStatus(success ? 'IDLE' : 'ERROR');
    }, 1000);

    return () => { if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current); };
  }, [products, categories, transactions, accounts, purchaseOrders, vendors, customers, userProfile, recurringExpenses, posSession, daySessions, isLoading]);

  const revertTransactionImpact = (tx: Transaction) => {
    if (tx.type === 'TRANSFER' && tx.accountId && tx.destinationAccountId) {
      setAccounts(prev => prev.map(acc => {
        if (acc.id === tx.accountId) return { ...acc, balance: Number(acc.balance) + Number(tx.amount) };
        if (acc.id === tx.destinationAccountId) return { ...acc, balance: Number(acc.balance) - Number(tx.amount) };
        return acc;
      }));
      return;
    }

    if (tx.paymentMethod !== 'CREDIT' && tx.paymentMethod !== 'CHEQUE') {
      const targetAccount = tx.accountId || (tx.paymentMethod === 'CASH' ? 'cash' : 'bank_default');
      setAccounts(prev => prev.map(acc => {
        if (acc.id === targetAccount) {
          const wasInflow = tx.type === 'SALE' || tx.type === 'CREDIT_PAYMENT';
          return { ...acc, balance: Number(acc.balance) - (wasInflow ? Number(tx.amount) : -Number(tx.amount)) };
        }
        return acc;
      }));
    }

    if (tx.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === tx.customerId) {
          if (tx.type === 'SALE' && tx.paymentMethod === 'CREDIT') return { ...c, totalCredit: Number(c.totalCredit) - Number(tx.amount) };
          if (tx.type === 'CREDIT_PAYMENT') return { ...c, totalCredit: Number(c.totalCredit) + Number(tx.amount) };
        }
        return c;
      }));
    }

    if (tx.vendorId) {
      setVendors(prev => prev.map(v => {
        if (v.id === tx.vendorId) {
          if (tx.type === 'PURCHASE' && tx.paymentMethod === 'CREDIT') return { ...v, totalBalance: Number(v.totalBalance || 0) - Number(tx.amount) };
          if (tx.type === 'EXPENSE' && (tx.paymentMethod === 'CASH' || tx.paymentMethod === 'BANK')) return { ...v, totalBalance: Number(v.totalBalance || 0) + Number(tx.amount) };
        }
        return v;
      }));
    }

    if (tx.items && Array.isArray(tx.items)) {
      setProducts(prev => prev.map(p => {
        const item = tx.items?.find((i: any) => i.productId === p.id);
        if (item) {
          const adjustment = tx.type === 'SALE' ? Number(item.quantity) : -Number(item.quantity);
          return { ...p, stock: Number(p.stock) + adjustment };
        }
        return p;
      }));
    }
  };

  const applyTransactionImpact = (tx: Transaction) => {
    if (tx.type === 'TRANSFER' && tx.accountId && tx.destinationAccountId) {
      setAccounts(prev => prev.map(acc => {
        if (acc.id === tx.accountId) return { ...acc, balance: Number(acc.balance) - Number(tx.amount) };
        if (acc.id === tx.destinationAccountId) return { ...acc, balance: Number(acc.balance) + Number(tx.amount) };
        return acc;
      }));
      return;
    }

    if (tx.paymentMethod !== 'CREDIT' && tx.paymentMethod !== 'CHEQUE') {
      const targetAccount = tx.accountId || (tx.paymentMethod === 'CASH' ? 'cash' : 'bank_default');
      setAccounts(prev => prev.map(acc => {
        if (acc.id === targetAccount) {
          const isInflow = tx.type === 'SALE' || tx.type === 'CREDIT_PAYMENT';
          return { ...acc, balance: Number(acc.balance) + (isInflow ? Number(tx.amount) : -Number(tx.amount)) };
        }
        return acc;
      }));
    }

    if (tx.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === tx.customerId) {
          if (tx.type === 'SALE' && tx.paymentMethod === 'CREDIT') return { ...c, totalCredit: Number(c.totalCredit) + Number(tx.amount) };
          if (tx.type === 'CREDIT_PAYMENT') return { ...c, totalCredit: Number(c.totalCredit) - Number(tx.amount) };
        }
        return c;
      }));
    }

    if (tx.vendorId) {
      setVendors(prev => prev.map(v => {
        if (v.id === tx.vendorId) {
          if (tx.type === 'PURCHASE' && tx.paymentMethod === 'CREDIT') return { ...v, totalBalance: Number(v.totalBalance || 0) + Number(tx.amount) };
          if (tx.type === 'EXPENSE' && (tx.paymentMethod === 'CASH' || tx.paymentMethod === 'BANK')) return { ...v, totalBalance: Number(v.totalBalance || 0) - Number(tx.amount) };
        }
        return v;
      }));
    }

    if (tx.items && Array.isArray(tx.items)) {
      setProducts(prev => prev.map(p => {
        const item = tx.items?.find((i: any) => i.productId === p.id);
        if (item) {
          const adjustment = tx.type === 'SALE' ? -Number(item.quantity) : Number(item.quantity);
          return { ...p, stock: Number(p.stock) + adjustment };
        }
        return p;
      }));
    }
  };

  const addTransaction = (partialTx: any) => {
    const tx: Transaction = {
      ...partialTx,
      id: partialTx.id || `TX-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      date: partialTx.date || new Date().toISOString(),
      amount: Number(partialTx.amount) || 0,
      discount: Number(partialTx.discount) || 0,
    };
    
    setTransactions(prev => [tx, ...prev]);
    applyTransactionImpact(tx);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    const originalTx = transactions.find(t => t.id === updatedTx.id);
    if (!originalTx) return;
    revertTransactionImpact(originalTx);
    applyTransactionImpact(updatedTx);
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
  };

  const handleDeleteTransaction = (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    revertTransactionImpact(tx);
    setTransactions(prev => prev.filter(t => t.id !== txId));
  };

  const handleReceivePO = (poId: string) => {
    const po = purchaseOrders.find(o => o.id === poId);
    if (!po) return;

    addTransaction({
      type: 'PURCHASE',
      amount: po.totalAmount,
      description: `Inward Stock Receipt: ${po.id}`,
      paymentMethod: po.paymentMethod,
      accountId: po.accountId,
      vendorId: po.vendorId,
      chequeNumber: po.chequeNumber,
      chequeDate: po.chequeDate,
      items: po.items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.cost }))
    });

    setPurchaseOrders(prev => prev.map(o => o.id === poId ? { ...o, status: 'RECEIVED', receivedDate: new Date().toISOString() } : o));
  };

  const handleUpdateProduct = (p: Product) => setProducts(prev => prev.map(old => old.id === p.id ? p : old));

  const handleOpenDay = (openingBalance: number) => {
    const date = new Date().toISOString().split('T')[0];
    const newSession: DaySession = { date, openingBalance, expectedClosing: openingBalance, status: 'OPEN' };
    setDaySessions(prev => [newSession, ...prev.filter(s => s.date !== date)]);
    setAccounts(prev => prev.map(acc => acc.id === 'cash' ? { ...acc, balance: openingBalance } : acc));
  };

  const handleCloseDay = (actualClosing: number) => {
    const date = new Date().toISOString().split('T')[0];
    setDaySessions(prev => prev.map(s => s.date === date ? { ...s, actualClosing, status: 'CLOSED' } : s));
  };

  const handleUpsertAccount = (acc: BankAccount) => {
    setAccounts(prev => {
      const exists = prev.find(a => a.id === acc.id);
      if (exists) return prev.map(a => a.id === acc.id ? acc : a);
      return [...prev, acc];
    });
  };

  const handleExport = () => {
    const data = { version: "5.0", exportDate: new Date().toISOString(), userProfile, products, categories, transactions, accounts, purchaseOrders, vendors, customers, recurringExpenses, daySessions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `prasama_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data.products)) setProducts(data.products);
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.transactions)) setTransactions(data.transactions);
        if (Array.isArray(data.accounts)) setAccounts(data.accounts);
        if (Array.isArray(data.vendors)) setVendors(data.vendors);
        if (Array.isArray(data.customers)) setCustomers(data.customers);
        if (data.userProfile) setUserProfile(data.userProfile);
        if (Array.isArray(data.purchaseOrders)) setPurchaseOrders(data.purchaseOrders);
        if (Array.isArray(data.daySessions)) setDaySessions(data.daySessions);
        if (Array.isArray(data.recurringExpenses)) setRecurringExpenses(data.recurringExpenses);
        alert("System restoration successful!");
      } catch (err) { alert("Critical: Invalid backup file format."); }
    };
    reader.readAsText(file);
  };

  const activeSession = Array.isArray(daySessions) ? daySessions.find(s => s.date === new Date().toISOString().split('T')[0]) : undefined;

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px]">Initializing Suite...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="no-print h-full flex-shrink-0 relative">
        <Sidebar 
          currentView={currentView} 
          setView={setCurrentView} 
          userProfile={userProfile} 
          accounts={accounts} 
          onEditProfile={() => setCurrentView('SETTINGS')} 
        />
      </div>
      <main className="flex-1 overflow-y-auto relative bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto px-6 py-8 md:px-10 md:py-12">
            {currentView === 'DASHBOARD' && <Dashboard transactions={transactions} products={products} accounts={accounts} categories={categories} vendors={vendors} />}
            {currentView === 'POS' && <POS accounts={accounts} products={products} customers={customers} categories={categories} userProfile={userProfile} onUpsertCustomer={(c) => setCustomers(prev => [...prev.filter(old => old.id !== c.id), c])} onUpdateProduct={handleUpdateProduct} onCompleteSale={addTransaction} posSession={posSession} setPosSession={setPosSession} activeSession={activeSession} onGoToFinance={() => setCurrentView('FINANCE')} onQuickOpenDay={handleOpenDay} />}
            {currentView === 'SALES_HISTORY' && <SalesHistory transactions={transactions} products={products} customers={customers} userProfile={userProfile} accounts={accounts} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} />}
            {currentView === 'INVENTORY' && <Inventory products={products} setProducts={setProducts} categories={categories} vendors={vendors} userProfile={userProfile} onAddCategory={(name) => setCategories(prev => [...prev, {id: `cat-${Date.now()}`, name}])} onDeleteCategory={(id) => setCategories(prev => prev.filter(c => c.id !== id))} onUpsertVendor={(v) => setVendors(prev => [...prev.filter(old => old.id !== v.id), v])} />}
            {currentView === 'BARCODE_PRINT' && <BarcodePrint products={products} categories={categories} />}
            {currentView === 'PURCHASES' && <Purchases transactions={transactions} accounts={accounts} products={products} purchaseOrders={purchaseOrders} vendors={vendors} userProfile={userProfile} onUpsertPO={(po) => setPurchaseOrders(prev => [po, ...prev.filter(old => old.id !== po.id)])} onReceivePO={handleReceivePO} onUpsertVendor={(v) => setVendors(prev => [...prev.filter(old => old.id !== v.id), v])} />}
            {currentView === 'FINANCE' && <Finance onUpsertAccount={handleUpsertAccount} transactions={transactions} accounts={accounts} products={products} userProfile={userProfile} vendors={vendors} daySessions={daySessions} onOpenDay={handleOpenDay} onCloseDay={handleCloseDay} onAddExpense={(tx) => addTransaction({ ...tx, type: 'EXPENSE' })} onAddTransfer={(tx) => addTransaction({ ...tx, type: 'TRANSFER' })} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} recurringExpenses={recurringExpenses} onAddRecurring={(schedule) => setRecurringExpenses(prev => [...prev, schedule])} onDeleteRecurring={(id) => setRecurringExpenses(prev => prev.filter(s => s.id !== id))} />}
            {currentView === 'CUSTOMERS' && <Customers customers={customers} transactions={transactions} onUpsertCustomer={(c) => setCustomers(prev => [...prev.filter(old => old.id !== c.id), c])} onReceivePayment={(tx) => addTransaction({ ...tx, type: 'CREDIT_PAYMENT' })} />}
            {currentView === 'CHEQUE_PRINT' && <ChequePrint />}
            {currentView === 'SETTINGS' && <Settings userProfile={userProfile} setUserProfile={setUserProfile} onExport={handleExport} onImport={handleImport} syncStatus={syncStatus} />}
        </div>
      </main>
    </div>
  );
};

export default App;
