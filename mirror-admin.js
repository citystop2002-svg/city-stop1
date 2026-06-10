(function(){
  const mirrorDb = firebase.firestore();
  const mirrorAuth = firebase.auth();
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

  function cleanId(value){
    return (value || `CS-ESP-${Date.now()}`)
      .toString()
      .trim()
      .replace(/[\/\\#?[\]]/g, "-")
      .replace(/\s+/g, "-");
  }

  function total(product){
    return n(product.total);
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
        <td><input data-mirror-edit="${product.id}:total" type="number" min="0" value="${total(product)}"></td>
        <td><input data-mirror-edit="${product.id}:unitCost" type="number" min="0" value="${n(product.unitCost)}"></td>
        <td><input data-mirror-edit="${product.id}:unitPrice" type="number" min="0" value="${n(product.unitPrice)}"></td>
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
    const value = n(event.target.value);
    const product = mirrorProducts.find(item => item.id === id);
    if(!product) return;
    product[field] = value;
    product.sideTotal = sideTotal(product);
    product.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await productCol.doc(id).update({
      [field]: value,
      sideTotal: product.sideTotal,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
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
    $("mirrorCostTag").textContent = `Costo ${money.format(cost)}`;
    $("mirrorSaleTag").textContent = `Venta ${money.format(sale)}`;
  }

  function renderProductOptions(){
    const current = $("mirrorSaleProduct").value;
    $("mirrorSaleProduct").innerHTML = mirrorProducts
      .map(product => `<option value="${product.id}">${product.name || product.code || product.id}</option>`)
      .join("");
    if(current && mirrorProducts.some(product => product.id === current)){
      $("mirrorSaleProduct").value = current;
    }
    syncSaleProduct();
  }

  function syncSaleProduct(){
    const product = selectedProduct();
    if(!product) return;
    $("mirrorUnitCost").value = n(product.unitCost);
    $("mirrorUnitSale").value = n(product.unitPrice);
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
    $("mirrorCostOut").textContent = money.format(cost);
    $("mirrorSaleOut").textContent = money.format(finalSale);
    $("mirrorCardFeeOut").textContent = money.format(cardFee);
    $("mirrorProfitOut").textContent = money.format(profit);
    $("mirrorUnitProfitOut").textContent = money.format(qty ? profit / qty : 0);

    return { qty, unitCost, unitSale, method, interest, cardFee, finalSale, cost, profit };
  }

  async function saveMirrorSale(){
    const product = selectedProduct();
    if(!product){
      alert("Selecciona un producto.");
      return;
    }

    const side = $("mirrorSaleSide").value;
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
          if(n(current.mirrorLeft) < data.qty || n(current.mirrorRight) < data.qty){
            throw new Error("No hay stock suficiente.");
          }
          updates.mirrorLeft = n(current.mirrorLeft) - data.qty;
          updates.mirrorRight = n(current.mirrorRight) - data.qty;
          updates.total = Math.max(n(current.total) - data.qty * 2, 0);
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
        <td>${money.format(n(sale.unitCost))}</td>
        <td>${money.format(n(sale.unitSale))}</td>
        <td>${sale.paymentMethod || ""}</td>
        <td>${money.format(n(sale.profit))}</td>
        <td><button class="delete-row" data-delete-mirror-sale="${sale.id}">Eliminar</button></td>
      </tr>
    `).join("") : `<tr><td colspan="8">Sin ventas registradas.</td></tr>`;

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
    toast("Producto registrado");
  }

  function renderMirrorReports(){
    const month = $("mirrorReportMonth").value;
    const date = $("mirrorReportDate").value;
    const monthRows = mirrorSales.filter(sale => (sale.date || "").startsWith(month));
    const dayRows = mirrorSales.filter(sale => sale.date === date);

    $("mirrorMonthSales").value = money.format(monthRows.reduce((sum, sale) => sum + n(sale.totalSale), 0));
    $("mirrorMonthProfit").value = money.format(monthRows.reduce((sum, sale) => sum + n(sale.profit), 0));
    $("mirrorDayQty").textContent = dayRows.reduce((sum, sale) => sum + n(sale.qty), 0);
    $("mirrorDaySales").textContent = money.format(dayRows.reduce((sum, sale) => sum + n(sale.totalSale), 0));
    $("mirrorDayProfit").textContent = money.format(dayRows.reduce((sum, sale) => sum + n(sale.profit), 0));

    const byDate = {};
    monthRows.forEach(sale => {
      byDate[sale.date] = (byDate[sale.date] || 0) + n(sale.profit);
    });
    const days = Object.keys(byDate).sort();
    const max = Math.max(...days.map(day => byDate[day]), 1);
    $("mirrorDailyChart").innerHTML = days.length ? days.map(day => `
      <div class="mirror-bar-row">
        <strong>${day.slice(5)}</strong>
        <div class="mirror-bar-track"><div class="mirror-bar" style="width:${Math.max((byDate[day] / max) * 100, 4)}%">${money.format(byDate[day])}</div></div>
        <span>${money.format(byDate[day])}</span>
      </div>
    `).join("") : `<div class="mirror-bar-row"><strong>Sin ventas</strong><div class="mirror-bar-track"><div class="mirror-bar" style="width:0">$0</div></div><span>$0</span></div>`;

    $("mirrorReportRows").innerHTML = dayRows.length ? dayRows.map(sale => `
      <tr>
        <td>${sale.date || ""}</td>
        <td>${sale.productName || ""}</td>
        <td>${n(sale.qty)}</td>
        <td>${money.format(n(sale.totalSale))}</td>
        <td>${money.format(n(sale.profit))}</td>
        <td><button class="delete-row" data-delete-mirror-sale="${sale.id}">Eliminar</button></td>
      </tr>
    `).join("") : `<tr><td colspan="6">No hay ventas registradas para esta fecha.</td></tr>`;

    document.querySelectorAll("[data-delete-mirror-sale]").forEach(button => {
      button.addEventListener("click", () => deleteMirrorSale(button.dataset.deleteMirrorSale));
    });
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
    $("mirrorAdminBtn").addEventListener("click", () => {
      $("mirrorAdmin").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("mirrorSaleShortcutBtn").addEventListener("click", () => showMirrorView("mirrorSaleView"));
    $("mirrorSeedBtn").addEventListener("click", seedMirrorInventory);
    $("mirrorSaleProduct").addEventListener("change", syncSaleProduct);
    ["mirrorSaleQty", "mirrorUnitCost", "mirrorUnitSale", "mirrorCardInterest"].forEach(id => {
      $(id).addEventListener("input", calculateMirrorSale);
    });
    $("mirrorPaymentMethod").addEventListener("change", calculateMirrorSale);
    $("mirrorSaveSaleBtn").addEventListener("click", saveMirrorSale);
    $("mirrorAddProductBtn").addEventListener("click", addMirrorProduct);
    ["mirrorSearch", "mirrorTypeFilter", "mirrorSideFilter", "mirrorStockFilter"].forEach(id => {
      $(id).addEventListener("input", renderMirrorInventory);
    });
    $("mirrorReportMonth").addEventListener("input", renderMirrorReports);
    $("mirrorReportDate").addEventListener("input", renderMirrorReports);
  }

  initMirrorAdmin();

  mirrorAuth.onAuthStateChanged(user => {
    if(user){
      listenMirrorData();
    }
  });
})();
