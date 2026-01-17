
import React, { useState, useMemo } from 'react';
import { Transaction, Product, Customer, UserProfile, BankAccount } from '../types';

interface SalesHistoryProps {
  transactions: Transaction[];
  products: Product[];
  customers: Customer[];
  userProfile: UserProfile;
  accounts: BankAccount[];
  onUpdateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ 
  transactions = [], 
  products = [], 
  customers = [], 
  userProfile, 
  accounts = [],
  onUpdateTransaction,
  onDeleteTransaction
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PAID' | 'DUE'>('ALL');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Transaction | null>(null);
  const [settlingTx, setSettlingTx] = useState<Transaction | null>(null);

  const sales = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    return transactions.filter(t => t && t.type === 'SALE');
  }, [transactions]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const txId = (s.id || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch = txId.includes(search);
      
      const txDateStr = typeof s.date === 'string' ? s.date.split('T')[0] : '';
      const matchesRange = (!startDate || txDateStr >= startDate) && (!endDate || txDateStr <= endDate);
      
      const isDue = s.paymentMethod === 'CREDIT';
      const matchesTab = activeTab === 'ALL' || (activeTab === 'PAID' && !isDue) || (activeTab === 'DUE' && isDue);

      return matchesSearch && matchesRange && matchesTab;
    });
  }, [sales, searchTerm, startDate, endDate, activeTab]);

  const summaryStats = useMemo(() => {
    const rangeSales = sales.filter(s => {
        const txDateStr = typeof s.date === 'string' ? s.date.split('T')[0] : '';
        return (!startDate || txDateStr >= startDate) && (!endDate || txDateStr <= endDate);
    });
    const paidAmount = rangeSales.filter(s => s.paymentMethod !== 'CREDIT').reduce((a, b) => a + Number(b.amount), 0);
    const dueAmount = rangeSales.filter(s => s.paymentMethod === 'CREDIT').reduce((a, b) => a + Number(b.amount), 0);
    return { paidAmount, dueAmount };
  }, [sales, startDate, endDate]);

  const getCustomerName = (id?: string) => {
    if (!id) return 'Walk-in Customer';
    return customers.find(c => c && c.id === id)?.name || 'Credit Client';
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'Unknown Item';

  const handlePrintReceipt = (tx: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoHtml = userProfile.logo
      ? `<div style="text-align: center; margin-bottom: 12px; width: 100%;">
           <img src="${userProfile.logo}" style="max-height: 90px; max-width: 220px; filter: grayscale(100%);" />
         </div>`
      : '';

    const itemsHtml = tx.items?.map((item: any) => {
      const product = products.find(p => p.id === item.productId);
      const rowGross = item.quantity * item.price;
      return `
        <div style="margin-bottom: 8px; border-bottom: 1px dashed #444; padding-bottom: 6px;">
          <div style="font-weight: 800; font-size: 13px; color: #000; text-transform: uppercase;">${product?.name || 'Unknown Item'}</div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-top: 2px;">
            <span>${item.quantity} x ${Number(item.price).toLocaleString()}</span>
            <span>${rowGross.toLocaleString()}</span>
          </div>
          ${(item.discount || 0) > 0 ? `<div style="text-align: right; font-size: 10px; color: #444;">DISC: -${item.discount.toLocaleString()}</div>` : ''}
        </div>
      `;
    }).join('');

    const dateStr = new Date(tx.date).toLocaleDateString();
    const timeStr = new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <html>
        <head>
          <title>DUPLICATE RECEIPT - ${tx.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
            body { font-family: 'JetBrains Mono', monospace; padding: 10px; color: #000; max-width: 280px; margin: 0 auto; background: #fff; line-height: 1.2; }
            .center { text-align: center; }
            .header-info { margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .biz-name { font-size: 18px; font-weight: 800; text-transform: uppercase; margin: 4px 0; }
            .biz-branch { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #333; }
            .meta { font-size: 10px; font-weight: 700; margin: 10px 0; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .total-section { margin-top: 15px; border-top: 3px double #000; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; }
            .footer { text-align: center; font-size: 10px; margin-top: 25px; font-weight: 800; border-top: 1px dashed #000; padding-top: 10px; }
            .duplicate-tag { text-align: center; border: 1px solid #000; font-size: 10px; font-weight: 800; margin-bottom: 10px; padding: 2px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="duplicate-tag">*** DUPLICATE RECEIPT ***</div>
          <div class="center">
            ${logoHtml}
            <div class="header-info">
               <div class="biz-name">${userProfile.name}</div>
               <div class="biz-branch">${userProfile.branch}</div>
            </div>
          </div>
          <div class="meta">
            REF: ${tx.id}<br/>
            DATE: ${dateStr} | TIME: ${timeStr}
          </div>
          <div style="margin-top: 10px;">${itemsHtml}</div>
          <div class="total-section">
             ${(tx.discount || 0) > 0 ? `
             <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;">
                <span>SAVINGS:</span>
                <span>-${Number(tx.discount).toLocaleString()}</span>
             </div>` : ''}
             <div class="total-row">
                <span>NET TOTAL:</span>
                <span>${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
             </div>
             <div style="font-size: 10px; text-align: right; margin-top: 4px; font-weight: 700;">PAID BY: ${tx.paymentMethod}</div>
          </div>
          <div class="footer">THANK YOU FOR YOUR BUSINESS<br/>PRASAMA ERP SOLUTIONS</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const updateEditingItem = (index: number, field: string, value: number) => {
    if (!editingTx || !editingTx.items) return;
    const newItems = [...editingTx.items];
    newItems[index] = { ...newItems[index], [field]: value };
    const newAmount = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setEditingTx({ ...editingTx, items: newItems, amount: newAmount });
  };

  const removeEditingItem = (index: number) => {
    if (!editingTx || !editingTx.items) return;
    const newItems = editingTx.items.filter((_, i) => i !== index);
    const newAmount = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setEditingTx({ ...editingTx, items: newItems, amount: newAmount });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTx) {
      onUpdateTransaction(editingTx);
      setEditingTx(null);
    }
  };

  const executeSettlement = (method: 'CASH' | 'BANK' | 'CARD', accountId: string) => {
    if (!settlingTx) return;
    const updatedTx: Transaction = {
      ...settlingTx,
      paymentMethod: method,
      accountId: accountId,
      description: `Settled Credit: ${settlingTx.description}`
    };
    onUpdateTransaction(updatedTx);
    setSettlingTx(null);
    alert("Invoice settlement authorized successfully.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Sales Architecture</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Operational Ledger & Settlement Analysis</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <button onClick={() => setActiveTab('ALL')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>All</button>
            <button onClick={() => setActiveTab('PAID')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PAID' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Settled</button>
            <button onClick={() => setActiveTab('DUE')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'DUE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Due</button>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex flex-col">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">From</label>
                <input type="date" className="text-[11px] font-black outline-none bg-transparent" value={startDate} onChange={e => setStartDate(e.target.value)} />
             </div>
             <div className="h-6 w-px bg-slate-100 mx-2"></div>
             <div className="flex flex-col">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">To</label>
                <input type="date" className="text-[11px] font-black outline-none bg-transparent" value={endDate} onChange={e => setEndDate(e.target.value)} />
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Period Volume</p>
            <p className="text-2xl font-black text-slate-900">{filteredSales.length} Entries</p>
         </div>
         <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Period Settled</p>
            <p className="text-2xl font-black text-emerald-700 font-mono">Rs. {summaryStats.paidAmount.toLocaleString()}</p>
         </div>
         <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 shadow-sm">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Period Due</p>
            <p className="text-2xl font-black text-rose-700 font-mono">Rs. {summaryStats.dueAmount.toLocaleString()}</p>
         </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 text-slate-400">
            <tr>
              <th className="px-8 py-6 font-black uppercase tracking-widest text-[10px]">Ref & Time</th>
              <th className="px-8 py-6 font-black uppercase tracking-widest text-[10px]">Client</th>
              <th className="px-8 py-6 font-black uppercase tracking-widest text-[10px]">Status</th>
              <th className="px-8 py-6 font-black uppercase tracking-widest text-[10px] text-right">Net Value</th>
              <th className="px-8 py-6 font-black uppercase tracking-widest text-[10px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredSales.map(tx => (
              <tr 
                key={tx.id} 
                onClick={() => setViewingReceipt(tx)}
                className="hover:bg-indigo-50/30 transition-all cursor-pointer group active:scale-[0.995]"
              >
                <td className="px-8 py-6">
                  <p className="font-black text-slate-900 text-[13px] uppercase">{tx.id}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-black text-slate-300 uppercase">{new Date(tx.date).toLocaleDateString()}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </td>
                <td className="px-8 py-6 font-black text-slate-700 uppercase tracking-tighter text-xs">
                   {getCustomerName(tx.customerId)}
                </td>
                <td className="px-8 py-6">
                  <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${tx.paymentMethod === 'CREDIT' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {tx.paymentMethod === 'CREDIT' ? 'Due' : 'Settled'}
                  </span>
                </td>
                <td className="px-8 py-6 text-right font-black font-mono text-slate-900 text-[15px]">
                  Rs. {Number(tx.amount).toLocaleString()}
                </td>
                <td className="px-8 py-6 text-center">
                  <div className="flex gap-2 justify-center">
                    {tx.paymentMethod === 'CREDIT' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSettlingTx(tx); }} 
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md"
                      >
                        Settle
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }} 
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm hover:bg-indigo-50 text-indigo-600 flex items-center justify-center transition-all"
                      title="Edit Transaction"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteTransaction(tx.id); }} 
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm hover:bg-rose-50 text-rose-500 flex items-center justify-center transition-all"
                      title="Delete Entry"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-32 text-center text-slate-300 font-black uppercase tracking-widest text-xs italic">
                  No sales found for the specified period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Settle Credit Modal */}
      {settlingTx && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
             <div className="p-10 border-b border-slate-50 bg-slate-50 flex justify-between items-center">
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Authorize Settlement</h3>
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Invoice: {settlingTx.id}</p>
                </div>
                <button onClick={() => setSettlingTx(null)} className="text-slate-300 text-4xl leading-none">&times;</button>
             </div>
             <div className="p-10 space-y-8">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Total</span>
                   <span className="text-2xl font-black text-slate-900 font-mono">Rs. {Number(settlingTx.amount).toLocaleString()}</span>
                </div>
                
                <div className="space-y-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Inflow Destination</label>
                   <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => executeSettlement('CASH', 'cash')} className="py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all flex flex-col items-center gap-2">
                        <span className="text-2xl">💵</span> Cash Drawer
                      </button>
                      <button onClick={() => executeSettlement('BANK', accounts.find(a => a.id !== 'cash')?.id || 'bank_default')} className="py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all flex flex-col items-center gap-2">
                        <span className="text-2xl">🏦</span> Bank Account
                      </button>
                   </div>
                </div>
                
                <button onClick={() => setSettlingTx(null)} className="w-full text-slate-300 font-black uppercase text-[10px] tracking-widest py-2">Cancel Operation</button>
             </div>
          </div>
        </div>
      )}

      {/* Receipt View Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in duration-300">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-black text-lg text-slate-900 uppercase tracking-tighter">Digital Duplicate</h3>
                 <button onClick={() => setViewingReceipt(null)} className="text-slate-300 hover:text-slate-900 text-3xl leading-none">&times;</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 font-mono">
                 <div className="text-center mb-8">
                    {userProfile.logo && (
                      <img src={userProfile.logo} className="h-16 mx-auto mb-4 grayscale" alt="Logo" />
                    )}
                    <h4 className="font-black text-slate-900 uppercase text-sm">{userProfile.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed mt-1">{userProfile.branch}</p>
                    <div className="border-b-2 border-slate-900 my-4"></div>
                    <div className="flex justify-between text-[10px] font-black text-slate-500">
                       <span>REF: {viewingReceipt.id}</span>
                       <span>{new Date(viewingReceipt.date).toLocaleDateString()}</span>
                    </div>
                 </div>

                 <div className="space-y-4 mb-8">
                    {viewingReceipt.items?.map((item, idx) => (
                      <div key={idx} className="border-b border-dashed border-slate-200 pb-3">
                        <div className="flex justify-between text-[11px] font-black text-slate-900">
                           <span className="uppercase">{getProductName(item.productId)}</span>
                           <span>Rs. {(item.quantity * item.price).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                           <span>{item.quantity} UN @ {Number(item.price).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                 </div>

                 <div className="space-y-2 border-t-2 border-slate-900 pt-4">
                    <div className="flex justify-between text-xs font-black text-slate-500">
                       <span>SUBTOTAL</span>
                       <span>Rs. {Number(viewingReceipt.amount + (viewingReceipt.discount || 0)).toLocaleString()}</span>
                    </div>
                    {viewingReceipt.discount && viewingReceipt.discount > 0 ? (
                      <div className="flex justify-between text-xs font-black text-emerald-600">
                         <span>SAVINGS</span>
                         <span>-Rs. {Number(viewingReceipt.discount).toLocaleString()}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-xl font-black text-slate-950 pt-2 border-t border-slate-100">
                       <span>TOTAL</span>
                       <span>Rs. {Number(viewingReceipt.amount).toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="mt-8 text-center space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Paid via: {viewingReceipt.paymentMethod}</p>
                    <p className="text-[9px] font-bold uppercase text-slate-300">Transaction ID verified by system audit</p>
                 </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-4">
                 <button 
                  onClick={() => setViewingReceipt(null)}
                  className="py-4 rounded-2xl font-black text-slate-400 uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                 >
                   Dismiss
                 </button>
                 <button 
                  onClick={() => handlePrintReceipt(viewingReceipt)}
                  className="bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95"
                 >
                   🖨️ Reprint
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Sale Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tighter">Audit Review</h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Transaction Ref: {editingTx.id}</p>
              </div>
              <button onClick={() => setEditingTx(null)} className="text-slate-300 hover:text-slate-900 text-4xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Profile</label>
                  <select 
                    className="w-full px-6 py-3.5 rounded-2xl border border-slate-200 font-bold bg-white outline-none focus:border-indigo-500 transition-colors uppercase text-xs"
                    value={editingTx.customerId || ''}
                    onChange={(e) => setEditingTx({ ...editingTx, customerId: e.target.value })}
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Date</label>
                  <input 
                    type="datetime-local"
                    className="w-full px-6 py-3.5 rounded-2xl border border-slate-200 font-bold bg-white outline-none focus:border-indigo-500 transition-colors text-xs"
                    value={new Date(editingTx.date).toISOString().slice(0, 16)}
                    onChange={(e) => setEditingTx({ ...editingTx, date: new Date(e.target.value).toISOString() })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Aggregate Total (Rs.)</label>
                  <div className="px-6 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 font-black font-mono text-indigo-600 text-sm">
                    {editingTx.amount.toLocaleString()}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Settlement Infrastructure</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['CASH', 'BANK', 'CARD', 'CREDIT'].map(m => (
                      <button 
                        key={m}
                        type="button"
                        onClick={() => setEditingTx({ ...editingTx, paymentMethod: m as any })}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${editingTx.paymentMethod === m ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Items Section */}
                <div className="col-span-2 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Itemized Receipt Manifesto</h4>
                    <span className="text-[9px] font-black text-indigo-500 uppercase">Interactive Override</span>
                  </div>
                  <div className="space-y-3">
                    {editingTx.items?.map((item, idx) => (
                      <div key={idx} className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 flex items-center gap-4 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-slate-800 uppercase truncate">{getProductName(item.productId)}</p>
                          <p className="text-[9px] text-slate-400 font-bold">Ref Code: {item.productId.slice(-6)}</p>
                        </div>
                        <div className="w-20">
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Qty</label>
                          <input 
                            type="number" 
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black font-mono outline-none focus:border-indigo-500"
                            value={item.quantity}
                            onChange={(e) => updateEditingItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Unit Value</label>
                          <input 
                            type="number" 
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black font-mono outline-none focus:border-indigo-500"
                            value={item.price}
                            onChange={(e) => updateEditingItem(idx, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-24 text-right">
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Subtotal</label>
                          <p className="text-xs font-black font-mono text-slate-900">{(item.quantity * item.price).toLocaleString()}</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeEditingItem(idx)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-50 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {(!editingTx.items || editingTx.items.length === 0) && (
                      <p className="text-center py-6 text-slate-400 text-[10px] font-bold uppercase italic">No line items in manifesto.</p>
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Correction Memo</label>
                  <input 
                    className="w-full px-6 py-3.5 rounded-2xl border border-slate-200 font-bold bg-white outline-none focus:border-indigo-500 transition-colors uppercase text-xs"
                    value={editingTx.description}
                    onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="pt-4 flex-shrink-0">
                <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-[0.2em] text-xs active:scale-[0.98]">
                  Authorize Correction Manifest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
