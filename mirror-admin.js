(function(){
  const mirrorDb = firebase.firestore();
  const mirrorAuth = firebase.auth();
  const localPersistence = firebase.auth.Auth && firebase.auth.Auth.Persistence
    ? firebase.auth.Auth.Persistence.LOCAL
    : null;
  if(localPersistence){
    mirrorAuth.setPersistence(localPersistence).catch(() => {});
  }
  const productCol = mirrorDb.collection("mirror_products");
  const salesCol = mirrorDb.collection("mirror_sales");
  const movementsCol = mirrorDb.collection("mirror_inventory_movements");

  let mirrorProducts = [];
  let mirrorSales = [];
  let unsubProducts = null;
  let unsubSales = null;

  const money = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });

  const $ = id => document.getElementById(id);
  const today = new Date().toISOString().slice(0, 10);

  function n(value){
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseMoney(value){
    if(typeof value === "number") return n(value);
    const cleaned = String(value || "").replace(/[^\d-]/g, "");
    return n(cleaned);
  }

  function formatMoney(value){
    return money.format(n(value)).replace(/\u00a0/g, " ");
  }

  function editableMoney(value){
    return `$ ${n(value).toLocaleString("es-CO")}`;
  }

  function escapeCell(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cleanId(value){
    return (value || `CS-ESP-${Date.now()}`)
      .toString()
      .trim()
      .replace(/[\/\\#?[\]]/g, "-")
      .replace(/\s+/g, "-");
  }

  function total(product){
    const computed = sideTotal(product);
    return computed || n(product.total);
  }

  function sideTotal(product){
    return n(product.mirrorLeft) + n(product.mirrorRight) + n(product.coverLeft) +
      n(product.coverRight) + n(product.glassLeft) + n(product.glassRight);
  }

  function toast(message){
    let el = document.querySelector(".mirror-toast");
    if(!el){
      el = document.createElement("div");
      el.className = "mirror-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  }

  function showMirrorView(id){
    document.querySelectorAll(".mirror-view").forEach(view => {
      view.classList.toggle("active", view.id === id);
    });
    document.querySelectorAll("[data-mirror-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.mirrorView === id);
    });
  }

  function productStatus(product){
    return total(product) <= 0
      ? `<span class="mirror-status out">Agotado</span>`
      : `<span class="mirror-status">Listo</span>`;
  }

  function selectedProduct(){
    return mirrorProducts.find(product => product.id === $("mirrorSaleProduct").value);
  }

  function findProductByCode(code){
    const normalized = String(code || "").trim().toLowerCase();
    if(!normalized) return null;
    return mirrorProducts.find(product =>
      String(product.code || "").trim().toLowerCase() === normalized ||
      String(product.id || "").trim().toLowerCase() === normalized
    );
  }

  function selectedField(side){
    return {
      "Izquierdo": "mirrorLeft",
      "Derecho": "mirrorRight",
      "Tapa izquierda": "coverLeft",
      "Tapa derecha": "coverRight",
      "Luna izquierda": "glassLeft",
      "Luna derecha": "glassRight"
    }[side];
  }

  function renderMirrorInventory(){
    const text = ($("mirrorSearch").value || "").toLowerCase();
    const type = $("mirrorTypeFilter").value;
    const side = $("mirrorSideFilter").value;
    const stock = $("mirrorStockFilter").value;

    let rows = mirrorProducts.filter(product => {
      return `${product.code || ""} ${product.name || ""} ${product.provider || ""}`.toLowerCase().includes(text);
    });

    if(type === "mirror") rows = rows.filter(p => n(p.mirrorLeft) + n(p.mirrorRight) > 0);
    if(type === "cover") rows = rows.filter(p => n(p.coverLeft) + n(p.coverRight) > 0);
    if(type === "glass") rows = rows.filter(p => n(p.glassLeft) + n(p.glassRight) > 0);
    if(side === "left") rows = rows.filter(p => n(p.mirrorLeft) + n(p.coverLeft) + n(p.glassLeft) > 0);
    if(side === "right") rows = rows.filter(p => n(p.mirrorRight) + n(p.coverRight) + n(p.glassRight) > 0);
    if(side === "pair") rows = rows.filter(p => n(p.mirrorLeft) > 0 && n(p.mirrorRight) > 0);
    if(stock === "stock") rows = rows.filter(p => total(p) > 0);
    if(stock === "out") rows = rows.filter(p => total(p) <= 0);

    $("mirrorInventoryBody").innerHTML = rows.length ? rows.map(product => `
      <tr>
        <td>${product.code || product.id}</td>
        <td>${product.name || ""}</td>
        <td>${product.provider || ""}</td>
        <td><input data-mirror-edit="${product.id}:mirrorLeft" type="number" min="0" value="${n(product.mirrorLeft)}"></td>
        <td><input data-mirror-edit="${product.id}:mirrorRight" type="number" min="0" value="${n(product.mirrorRight)}"></td>
        <td><input data-mirror-edit="${product.id}:coverLeft" type="number" min="0" value="${n(product.coverLeft)}"></td>
        <td><input data-mirror-edit="${product.id}:coverRight" type="number" min="0" value="${n(product.coverRight)}"></td>
        <td><input data-mirror-edit="${product.id}:glassLeft" type="number" min="0" value="${n(product.glassLeft)}"></td>
        <td><input data-mirror-edit="${product.id}:glassRight" type="number" min="0" value="${n(product.glassRight)}"></td>
        <td><input class="total-input" data-mirror-edit="${product.id}:total" type="number" min="0" value="${total(product)}" readonly></td>
        <td><input class="money-input" data-mirror-edit="${product.id}:unitCost" type="text" inputmode="numeric" value="${editableMoney(product.unitCost)}"></td>
        <td><input class="money-input" data-mirror-edit="${product.id}:unitPrice" type="text" inputmode="numeric" value="${editableMoney(product.unitPrice)}"></td>
        <td>${productStatus(product)}</td>
      </tr>
    `).join("") : `<tr><td colspan="13">No hay productos de espejos.</td></tr>`;

    document.querySelectorAll("[data-mirror-edit]").forEach(input => {
      input.addEventListener("change", updateMirrorProductField);
    });

    renderMirrorTotals();
    renderProductOptions();
  }

  async function updateMirrorProductField(event){
    const [id, field] = event.target.dataset.mirrorEdit.split(":");
    const moneyFields = ["unitCost", "unitPrice"];
    const sideFields = ["mirrorLeft", "mirrorRight", "coverLeft", "coverRight", "glassLeft", "glassRight"];
    const value = moneyFields.includes(field) ? parseMoney(event.target.value) : n(event.target.value);
    const product = mirrorProducts.find(item => item.id === id);
    if(!product) return;
    product[field] = value;
    if(moneyFields.includes(field)){
      event.target.value = editableMoney(value);
    }
    product.sideTotal = sideTotal(product);
    if(sideFields.includes(field)){
      product.total = product.sideTotal;
    }
    product.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    const updates = {
      [field]: value,
      sideTotal: product.sideTotal,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if(sideFields.includes(field)){
      updates.total = product.total;
    }
    await productCol.doc(id).update(updates);
    await movementsCol.add({
      type: "edit",
      productId: id,
      field,
      value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast("Producto actualizado");
  }

  function renderMirrorTotals(){
    const units = mirrorProducts.reduce((sum, product) => sum + total(product), 0);
    const cost = mirrorProducts.reduce((sum, product) => sum + total(product) * n(product.unitCost), 0);
    const sale = mirrorProducts.reduce((sum, product) => sum + total(product) * n(product.unitPrice), 0);
    $("mirrorUnitsTag").textContent = `${units} unidades reales`;
    $("mirrorCostTag").textContent = `Costo ${formatMoney(cost)}`;
    $("mirrorSaleTag").textContent = `Venta ${formatMoney(sale)}`;
  }

  function renderProductOptions(){
    const current = $("mirrorSaleProduct").value;
    $("mirrorSaleProduct").innerHTML = mirrorProducts
      .map(product => `<option value="${product.id}">${product.name || product.code || product.id}</option>`)
      .join("");
    if($("mirrorProductCodeList")){
      $("mirrorProductCodeList").innerHTML = mirrorProducts
        .filter(product => product.code || product.id)
        .map(product => `<option value="${product.code || product.id}">${product.name || ""}</option>`)
        .join("");
    }
    if(current && mirrorProducts.some(product => product.id === current)){
      $("mirrorSaleProduct").value = current;
    }
    syncSaleProduct();
  }

  function syncSaleProduct(){
    const product = selectedProduct();
    if(!product) return;
    if($("mirrorSaleCode")){
      $("mirrorSaleCode").value = product.code || product.id || "";
    }
    $("mirrorUnitCost").value = n(product.unitCost);
    $("mirrorUnitSale").value = n(product.unitPrice);
    calculateMirrorSale();
  }

  function syncSaleCode(){
    const product = findProductByCode($("mirrorSaleCode").value);
    if(!product) return;
    $("mirrorSaleProduct").value = product.id;
    syncSaleProduct();
  }

  function syncPairQuantity(){
    const qtyInput = $("mirrorSaleQty");
    const isPair = $("mirrorSaleSide").value === "Par L R";
    if(isPair){
      qtyInput.value = 1;
      qtyInput.readOnly = true;
      qtyInput.title = "Un par descuenta 1 izquierdo y 1 derecho.";
    }else{
      qtyInput.readOnly = false;
      qtyInput.title = "";
    }
    calculateMirrorSale();
  }

  function calculateMirrorSale(){
    const qty = n($("mirrorSaleQty").value);
    const unitCost = n($("mirrorUnitCost").value);
    const unitSale = n($("mirrorUnitSale").value);
    const method = $("mirrorPaymentMethod").value;
    const interest = n($("mirrorCardInterest").value);
    const usesCard = method === "Tarjeta crédito";
    const baseSale = qty * unitSale;
    const cardFee = usesCard ? baseSale * (interest / 100) : 0;
    const finalSale = baseSale + cardFee;
    const cost = qty * unitCost;
    const profit = finalSale - cost;

    $("mirrorCardInterestWrap").classList.toggle("hidden", !usesCard);
    $("mirrorCostOut").textContent = formatMoney(cost);
    $("mirrorSaleOut").textContent = formatMoney(finalSale);
    $("mirrorCardFeeOut").textContent = formatMoney(cardFee);
    $("mirrorProfitOut").textContent = formatMoney(profit);
    $("mirrorUnitProfitOut").textContent = formatMoney(qty ? profit / qty : 0);

    return { qty, unitCost, unitSale, method, interest, cardFee, finalSale, cost, profit };
  }

  async function saveMirrorSale(){
    const product = selectedProduct();
    if(!product){
      alert("Selecciona un producto.");
      return;
    }

    const side = $("mirrorSaleSide").value;
    if(side === "Par L R"){
      $("mirrorSaleQty").value = 1;
    }
    const data = calculateMirrorSale();
    if(data.qty <= 0){
      alert("La cantidad debe ser mayor a 0.");
      return;
    }

    const productRef = productCol.doc(product.id);
    const saleRef = salesCol.doc();

    try{
      await mirrorDb.runTransaction(async transaction => {
        const snap = await transaction.get(productRef);
        if(!snap.exists) throw new Error("Producto no encontrado.");
        const current = snap.data();
        const updates = {
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if(side === "Par L R"){
          if(n(current.mirrorLeft) < 1 || n(current.mirrorRight) < 1){
            throw new Error("No hay stock suficiente.");
          }
          updates.mirrorLeft = n(current.mirrorLeft) - 1;
          updates.mirrorRight = n(current.mirrorRight) - 1;
          updates.total = Math.max(n(current.total) - 2, 0);
        }else{
          const field = selectedField(side);
          if(!field) throw new Error("Selecciona un lado válido.");
          if(n(current[field]) < data.qty){
            throw new Error("No hay stock suficiente.");
          }
          updates[field] = n(current[field]) - data.qty;
          updates.total = Math.max(n(current.total) - data.qty, 0);
        }

        updates.sideTotal =
          n(updates.mirrorLeft ?? current.mirrorLeft) +
          n(updates.mirrorRight ?? current.mirrorRight) +
          n(updates.coverLeft ?? current.coverLeft) +
          n(updates.coverRight ?? current.coverRight) +
          n(updates.glassLeft ?? current.glassLeft) +
          n(updates.glassRight ?? current.glassRight);
        updates.total = updates.sideTotal;

        const sale = {
          productId: product.id,
          productName: product.name || "",
          side,
          qty: data.qty,
          unitCost: data.unitCost,
          unitSale: data.unitSale,
          paymentMethod: data.method,
          cardInterest: data.method === "Tarjeta crédito" ? data.interest : 0,
          cardFee: data.cardFee,
          totalSale: data.finalSale,
          totalCost: data.cost,
          profit: data.profit,
          customer: $("mirrorCustomer").value.trim(),
          date: $("mirrorSaleDate").value,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        transaction.update(productRef, updates);
        transaction.set(saleRef, sale);
      });

      await movementsCol.add({
        type: "sale",
        productId: product.id,
        productName: product.name || "",
        side,
        qty: data.qty,
        date: $("mirrorSaleDate").value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      toast("Producto registrado");
    }catch(error){
      alert(error.message);
    }
  }

  function renderMirrorSales(){
    $("mirrorSalesBody").innerHTML = mirrorSales.length ? mirrorSales.map(sale => `
      <tr>
        <td>${sale.date || ""}</td>
        <td>${sale.productName || ""}</td>
        <td>${sale.side || ""}</td>
        <td>${formatMoney(sale.unitCost)}</td>
        <td>${formatMoney(sale.unitSale)}</td>
        <td>${sale.paymentMethod || ""}</td>
        <td>${formatMoney(sale.profit)}</td>
        <td><button class="delete-row" data-delete-mirror-sale="${sale.id}">Eliminar</button></td>
      </tr>
    `).join("") : `<tr><td colspan="8">Sin ventas registradas.</td></tr>`;

    const registeredTotal = mirrorSales.reduce((sum, sale) => sum + n(sale.totalSale), 0);
    if($("mirrorRegisteredSalesTotal")){
      $("mirrorRegisteredSalesTotal").textContent = formatMoney(registeredTotal);
    }

    document.querySelectorAll("[data-delete-mirror-sale]").forEach(button => {
      button.addEventListener("click", () => deleteMirrorSale(button.dataset.deleteMirrorSale));
    });

    renderMirrorReports();
  }

  async function deleteMirrorSale(id){
    const sale = mirrorSales.find(item => item.id === id);
    if(!sale || !confirm("¿Eliminar esta venta y devolver el stock?")) return;

    const productRef = productCol.doc(sale.productId);
    const saleRef = salesCol.doc(id);

    try{
      await mirrorDb.runTransaction(async transaction => {
        const snap = await transaction.get(productRef);
        if(!snap.exists) throw new Error("Producto no encontrado.");
        const product = snap.data();
        const updates = {
          total: n(product.total) + n(sale.qty),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if(sale.side === "Par L R"){
          updates.mirrorLeft = n(product.mirrorLeft) + n(sale.qty);
          updates.mirrorRight = n(product.mirrorRight) + n(sale.qty);
          updates.total = n(product.total) + n(sale.qty) * 2;
        }else{
          const field = selectedField(sale.side);
          if(field) updates[field] = n(product[field]) + n(sale.qty);
        }
        updates.sideTotal =
          n(updates.mirrorLeft ?? product.mirrorLeft) +
          n(updates.mirrorRight ?? product.mirrorRight) +
          n(updates.coverLeft ?? product.coverLeft) +
          n(updates.coverRight ?? product.coverRight) +
          n(updates.glassLeft ?? product.glassLeft) +
          n(updates.glassRight ?? product.glassRight);
        updates.total = updates.sideTotal;

        transaction.update(productRef, updates);
        transaction.delete(saleRef);
      });

      await movementsCol.add({
        type: "delete_sale",
        saleId: id,
        productId: sale.productId,
        qty: sale.qty,
        date: sale.date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast("Registro eliminado");
    }catch(error){
      alert(error.message);
    }
  }

  async function seedMirrorInventory(){
    const snapshot = await productCol.limit(1).get();
    if(!snapshot.empty && !confirm("Ya hay productos de espejos. ¿Quieres cargar los faltantes sin borrar lo existente?")){
      return;
    }

    const batch = mirrorDb.batch();
    (window.mirrorInitialProducts || []).forEach(product => {
      const id = cleanId(product.id || product.code);
      const ref = productCol.doc(id);
      batch.set(ref, {
        ...product,
        id,
        sideTotal: sideTotal(product),
        total: sideTotal(product),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
    toast("Inventario de espejos cargado");
  }

  async function addMirrorProduct(){
    const name = $("mirrorNewName").value.trim();
    if(!name){
      alert("Escribe el nombre del producto.");
      return;
    }

    const code = $("mirrorNewCode").value.trim();
    const type = $("mirrorNewType").value;
    const left = n($("mirrorNewLeft").value);
    const right = n($("mirrorNewRight").value);
    const product = {
      id: cleanId(code || name),
      code,
      name,
      provider: $("mirrorNewProvider").value.trim(),
      mirrorLeft: 0,
      mirrorRight: 0,
      coverLeft: 0,
      coverRight: 0,
      glassLeft: 0,
      glassRight: 0,
      total: left + right,
      unitCost: n($("mirrorNewCost").value),
      unitPrice: n($("mirrorNewPrice").value),
      active: true,
      source: "admin_manual",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if(type === "mirror"){
      product.mirrorLeft = left;
      product.mirrorRight = right;
    }
    if(type === "cover"){
      product.coverLeft = left;
      product.coverRight = right;
    }
    if(type === "glass"){
      product.glassLeft = left;
      product.glassRight = right;
    }
    product.sideTotal = sideTotal(product);

    await productCol.doc(product.id).set(product, { merge: true });
    ["mirrorNewCode", "mirrorNewName", "mirrorNewProvider", "mirrorNewLeft", "mirrorNewRight", "mirrorNewCost", "mirrorNewPrice"].forEach(id => {
      if($(id)) $(id).value = ["mirrorNewLeft", "mirrorNewRight"].includes(id) ? 0 : "";
    });
    toast("Producto registrado");
  }

  function renderMirrorReports(){
    const month = $("mirrorReportMonth").value;
    const date = $("mirrorReportDate").value;
    const monthRows = mirrorSales.filter(sale => (sale.date || "").startsWith(month));
    const dayRows = mirrorSales.filter(sale => sale.date === date);

    $("mirrorMonthSales").value = formatMoney(monthRows.reduce((sum, sale) => sum + n(sale.totalSale), 0));
    $("mirrorMonthProfit").value = formatMoney(monthRows.reduce((sum, sale) => sum + n(sale.profit), 0));
    $("mirrorDayQty").textContent = dayRows.reduce((sum, sale) => sum + n(sale.qty), 0);
    $("mirrorDaySales").textContent = formatMoney(dayRows.reduce((sum, sale) => sum + n(sale.totalSale), 0));
    $("mirrorDayProfit").textContent = formatMoney(dayRows.reduce((sum, sale) => sum + n(sale.profit), 0));

    const byDate = {};
    monthRows.forEach(sale => {
      byDate[sale.date] = (byDate[sale.date] || 0) + n(sale.profit);
    });
    const days = Object.keys(byDate).sort();
    const max = Math.max(...days.map(day => byDate[day]), 1);
    $("mirrorDailyChart").innerHTML = days.length ? days.map(day => `
      <div class="mirror-bar-row">
        <strong>${day.slice(5)}</strong>
        <div class="mirror-bar-track"><div class="mirror-bar" style="width:${Math.max((byDate[day] / max) * 100, 4)}%">${formatMoney(byDate[day])}</div></div>
        <span>${formatMoney(byDate[day])}</span>
      </div>
    `).join("") : `<div class="mirror-bar-row"><strong>Sin ventas</strong><div class="mirror-bar-track"><div class="mirror-bar" style="width:0">$0</div></div><span>$0</span></div>`;

    $("mirrorReportRows").innerHTML = dayRows.length ? dayRows.map(sale => `
      <tr>
        <td>${sale.date || ""}</td>
        <td>${sale.productName || ""}</td>
        <td>${n(sale.qty)}</td>
        <td>${formatMoney(sale.totalSale)}</td>
        <td>${formatMoney(sale.profit)}</td>
        <td><button class="delete-row" data-delete-mirror-sale="${sale.id}">Eliminar</button></td>
      </tr>
    `).join("") : `<tr><td colspan="6">No hay ventas registradas para esta fecha.</td></tr>`;

    document.querySelectorAll("[data-delete-mirror-sale]").forEach(button => {
      button.addEventListener("click", () => deleteMirrorSale(button.dataset.deleteMirrorSale));
    });
  }

  function exportMirrorExcel(){
    const month = $("mirrorReportMonth")?.value || today.slice(0, 7);
    const monthRows = mirrorSales
      .filter(sale => (sale.date || "").startsWith(month))
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    const byDate = {};
    monthRows.forEach(sale => {
      const date = sale.date || "Sin fecha";
      if(!byDate[date]){
        byDate[date] = { qty: 0, totalSale: 0, profit: 0 };
      }
      byDate[date].qty += n(sale.qty);
      byDate[date].totalSale += n(sale.totalSale);
      byDate[date].profit += n(sale.profit);
    });

    const totalSale = monthRows.reduce((sum, sale) => sum + n(sale.totalSale), 0);
    const totalProfit = monthRows.reduce((sum, sale) => sum + n(sale.profit), 0);
    const totalQty = monthRows.reduce((sum, sale) => sum + n(sale.qty), 0);

    const salesRows = monthRows.map(sale => `
      <tr>
        <td>${escapeCell(sale.date)}</td>
        <td>${escapeCell(sale.productId)}</td>
        <td>${escapeCell(sale.productName)}</td>
        <td>${escapeCell(sale.side)}</td>
        <td>${n(sale.qty)}</td>
        <td>${n(sale.unitCost)}</td>
        <td>${n(sale.unitSale)}</td>
        <td>${n(sale.cardFee)}</td>
        <td>${n(sale.totalSale)}</td>
        <td>${n(sale.totalCost)}</td>
        <td>${n(sale.profit)}</td>
        <td>${escapeCell(sale.paymentMethod)}</td>
        <td>${escapeCell(sale.customer)}</td>
      </tr>
    `).join("");

    const dayRows = Object.keys(byDate).sort().map(date => `
      <tr>
        <td>${escapeCell(date)}</td>
        <td>${byDate[date].qty}</td>
        <td>${byDate[date].totalSale}</td>
        <td>${byDate[date].profit}</td>
      </tr>
    `).join("");

    const workbook = `
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body{font-family:Arial,sans-serif}
          h1,h2{color:#0f4c5c}
          table{border-collapse:collapse;margin-bottom:24px;width:100%}
          th{background:#0f4c5c;color:white}
          th,td{border:1px solid #b7c4cf;padding:7px;text-align:left}
          .summary td{font-weight:bold}
        </style>
      </head>
      <body>
        <h1>Reporte espejos City Stop - ${escapeCell(month)}</h1>
        <h2>Resumen del mes</h2>
        <table class="summary">
          <tr><td>Total unidades vendidas</td><td>${totalQty}</td></tr>
          <tr><td>Total venta</td><td>${totalSale}</td></tr>
          <tr><td>Total ganancia</td><td>${totalProfit}</td></tr>
        </table>

        <h2>Datos diarios para gráfica</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Cantidad vendida</th><th>Total venta</th><th>Ganancia</th></tr></thead>
          <tbody>${dayRows || `<tr><td colspan="4">Sin ventas en este mes</td></tr>`}</tbody>
        </table>

        <h2>Ventas registradas</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Código</th><th>Producto</th><th>Lado / pieza</th><th>Cantidad</th>
              <th>Costo unitario</th><th>Venta unitaria</th><th>Recargo tarjeta</th><th>Total venta</th>
              <th>Total costo</th><th>Ganancia</th><th>Medio de pago</th><th>Cliente</th>
            </tr>
          </thead>
          <tbody>${salesRows || `<tr><td colspan="13">Sin ventas registradas en este mes</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-espejos-city-stop-${month}.xls`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    toast("Reporte exportado");
  }

  function listenMirrorData(){
    if(unsubProducts) unsubProducts();
    if(unsubSales) unsubSales();

    unsubProducts = productCol.orderBy("name").onSnapshot(snapshot => {
      mirrorProducts = [];
      snapshot.forEach(doc => mirrorProducts.push({ id: doc.id, ...doc.data() }));
      renderMirrorInventory();
    });

    unsubSales = salesCol.orderBy("createdAt", "desc").limit(100).onSnapshot(snapshot => {
      mirrorSales = [];
      snapshot.forEach(doc => mirrorSales.push({ id: doc.id, ...doc.data() }));
      renderMirrorSales();
    });
  }

  function initMirrorAdmin(){
    $("mirrorSaleDate").value = today;
    $("mirrorReportDate").value = today;
    $("mirrorReportMonth").value = today.slice(0, 7);

    document.querySelectorAll("[data-mirror-view]").forEach(button => {
      button.addEventListener("click", () => showMirrorView(button.dataset.mirrorView));
    });
    const adminButton = $("mirrorAdminBtn");
    if(adminButton && !adminButton.getAttribute("href")){
      adminButton.addEventListener("click", () => {
        $("mirrorAdmin").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }else if(adminButton){
      adminButton.addEventListener("click", () => {
        localStorage.setItem("mirrorAdminLastOpen", String(Date.now()));
      });
    }
    if($("mirrorSaleShortcutBtn")){
      $("mirrorSaleShortcutBtn").addEventListener("click", () => showMirrorView("mirrorSaleView"));
    }
    if($("mirrorSeedBtn")){
      $("mirrorSeedBtn").addEventListener("click", seedMirrorInventory);
    }
    if($("mirrorExportExcelBtn")){
      $("mirrorExportExcelBtn").addEventListener("click", exportMirrorExcel);
    }
    $("mirrorSaleProduct").addEventListener("change", syncSaleProduct);
    if($("mirrorSaleCode")){
      $("mirrorSaleCode").addEventListener("change", syncSaleCode);
      $("mirrorSaleCode").addEventListener("blur", syncSaleCode);
    }
    ["mirrorSaleQty", "mirrorUnitCost", "mirrorUnitSale", "mirrorCardInterest"].forEach(id => {
      $(id).addEventListener("input", calculateMirrorSale);
    });
    $("mirrorSaleSide").addEventListener("change", syncPairQuantity);
    $("mirrorPaymentMethod").addEventListener("change", calculateMirrorSale);
    $("mirrorSaveSaleBtn").addEventListener("click", saveMirrorSale);
    $("mirrorAddProductBtn").addEventListener("click", addMirrorProduct);
    ["mirrorSearch", "mirrorTypeFilter", "mirrorSideFilter", "mirrorStockFilter"].forEach(id => {
      $(id).addEventListener("input", renderMirrorInventory);
    });
    $("mirrorReportMonth").addEventListener("input", renderMirrorReports);
    $("mirrorReportDate").addEventListener("input", renderMirrorReports);

    if($("mirrorLoginBtn")){
      $("mirrorLoginBtn").addEventListener("click", () => {
        const email = $("mirrorEmail").value.trim();
        const password = $("mirrorPassword").value;
        mirrorAuth.signInWithEmailAndPassword(email, password).catch(error => alert(error.message));
      });
    }
    if($("mirrorLogoutBtn")){
      $("mirrorLogoutBtn").addEventListener("click", () => mirrorAuth.signOut());
    }
    syncPairQuantity();
  }

  initMirrorAdmin();

  if(!$("mirrorLoginBox")){
    listenMirrorData();
  }

  mirrorAuth.onAuthStateChanged(user => {
    if($("mirrorLoginBox") && $("mirrorPagePanel")){
      $("mirrorLoginBox").style.display = user ? "none" : "block";
      $("mirrorPagePanel").style.display = user ? "block" : "none";
    }
    if(user){
      listenMirrorData();
    }
  });
})();
