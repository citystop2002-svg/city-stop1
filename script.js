firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

const container = document.getElementById("products");
const buscador = document.getElementById("searchInput");

const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeModal = document.getElementById("closeModal");
const prevImage = document.getElementById("prevImage");
const nextImage = document.getElementById("nextImage");
const rotateBtn = document.getElementById("rotateBtn");
const darkModeBtn = document.getElementById("darkModeBtn");
const loader = document.getElementById("loader");

let productosFirebase = [];
let productosMostrados = [];
let modalImages = [];
let modalIndex = 0;
let marcaActiva = "todos";

window.addEventListener("load", () => {
  setTimeout(() => {
    loader.style.display = "none";
  }, 1200);
});

function mostrarProductos(lista){
  productosMostrados = lista;
  container.innerHTML = "";

  if(lista.length === 0){
    container.innerHTML = `<p class="no-results">No se encontraron productos.</p>`;
    return;
  }

  lista.forEach((producto, index) => {
    const imagenPrincipal = producto.imagen || "img/sin-imagen.png";
    const imagenHover = producto.hover || producto.imagen || "img/sin-imagen.png";
    const marca = producto.marca || "";
    const lado = producto.lado || "";
    const ladoClase = lado.toLowerCase().includes("ambos") ? " side-badge-both" : "";
    const modelo = producto.modelo ? `Modelo ${producto.modelo}` : "";
    const detalles = [modelo, producto.tipo, producto.detalle].filter(Boolean);

    const mensaje = `
Hola City Stop 🚗

Quiero este espejo:

📌 Producto: ${producto.nombre || ""}
🚘 Marca: ${marca || ""}
↔️ Lado: ${lado || ""}
📅 Modelo: ${producto.modelo || ""}
⚙️ Tipo: ${producto.tipo || ""}
🆔 Código: ${producto.codigo || ""}
💲 Precio: ${producto.precio || ""}
📦 Estado: ${producto.stock || ""}
📝 Descripción: ${producto.descripcion || ""}
`;

    const whatsappURL =
    `https://wa.me/573059117424?text=${encodeURIComponent(mensaje)}`;

    container.innerHTML += `
      <div class="product-card">
        <img src="img/logo.png" class="card-logo">

        <div class="product-badges">
          <span class="stock">${producto.stock || "Disponible"}</span>
          ${lado ? `<span class="side-badge${ladoClase}">${lado}</span>` : ""}
        </div>

        ${producto.descuento ? `<span class="discount">${producto.descuento}</span>` : ""}

        <div class="image-container" onclick="abrirModal(${index})">
          <img class="main-image" src="${imagenPrincipal}">
          <img class="hover-image" src="${imagenHover}">
        </div>

        ${marca ? `<div class="brand-line">${marca}</div>` : ""}
        <h3>${producto.nombre || "Sin nombre"}</h3>

        ${
          detalles.length
          ? `<div class="product-meta">
              ${detalles.map(item => `<span>${item}</span>`).join("")}
            </div>`
          : ""
        }

        <p>${producto.precio || "$0"}</p>
        <small>${producto.descripcion || ""}</small>

        <a class="btn-whatsapp" href="${whatsappURL}" target="_blank">
          Consultar
        </a>
      </div>
    `;
  });
}

function aplicarFiltros(){
  const texto = buscador.value.toLowerCase();

  let filtrados = productosFirebase.filter(producto => {
    const coincideTexto =
      (producto.nombre || "").toLowerCase().includes(texto) ||
      (producto.descripcion || "").toLowerCase().includes(texto) ||
      (producto.codigo || "").toLowerCase().includes(texto) ||
      (producto.marca || "").toLowerCase().includes(texto) ||
      (producto.lado || "").toLowerCase().includes(texto) ||
      (producto.modelo || "").toLowerCase().includes(texto) ||
      (producto.tipo || "").toLowerCase().includes(texto) ||
      (producto.detalle || "").toLowerCase().includes(texto);

    const coincideMarca =
      marcaActiva === "todos" ||
      (producto.marca || "").toLowerCase() === marcaActiva;

    return coincideTexto && coincideMarca;
  });

  mostrarProductos(filtrados);
}

db.collection("productos").onSnapshot(snapshot => {
  productosFirebase = [];

    snapshot.forEach(doc => {

  const producto = {
    id: doc.id,
    ...doc.data()
  };
       if(producto.visible === false || producto.visible === "false"){
    return;
  }

  productosFirebase.push(producto);
});

  mostrarProductos(productosFirebase);
});

buscador.addEventListener("keyup", aplicarFiltros);

document.querySelectorAll(".brand-filters button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".brand-filters button")
    .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");
    marcaActiva = btn.dataset.marca;
    aplicarFiltros();
  });
});

function abrirModal(index){
  const producto = productosMostrados[index];

  modalImages = [
    producto.imagen || "img/sin-imagen.png",
    producto.hover || producto.imagen || "img/sin-imagen.png"
  ];

  modalIndex = 0;
  modalImage.src = modalImages[modalIndex];
  imageModal.classList.add("active");
}

function cambiarImagen(){
  modalIndex = modalIndex === 0 ? 1 : 0;

  modalImage.classList.add("change");

  setTimeout(() => {
    modalImage.src = modalImages[modalIndex];
    modalImage.classList.remove("change");
  }, 180);
}

nextImage.addEventListener("click", e => {
  e.stopPropagation();
  cambiarImagen();
});

prevImage.addEventListener("click", e => {
  e.stopPropagation();
  cambiarImagen();
});

closeModal.addEventListener("click", () => {
  imageModal.classList.remove("active");
});

imageModal.addEventListener("click", e => {
  if(e.target === imageModal){
    imageModal.classList.remove("active");
  }
});

rotateBtn.addEventListener("click", () => {
  modalImage.classList.remove("rotate360");
  void modalImage.offsetWidth;
  modalImage.classList.add("rotate360");
});

darkModeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

document.addEventListener("keydown", e => {
  if(!imageModal.classList.contains("active")){
    return;
  }

  if(e.key === "Escape"){
    imageModal.classList.remove("active");
  }

  if(e.key === "ArrowRight" || e.key === "ArrowLeft"){
    cambiarImagen();
  }
});
