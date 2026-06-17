// cupons.js

function obterDados(chave) {
    const dados = localStorage.getItem(chave);
    try {
        return dados ? JSON.parse(dados) : null;
    } catch (e) {
        console.error("Erro ao parsear dados do localStorage para a chave:", chave, e);
        return null;
    }
}

function salvarDados(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
}

let cuponsDisponiveis = [];
let cupomParaAcao = null; 
const ITENS_POR_PAGINA = 10; 
let paginaAtual = 1;

document.addEventListener("DOMContentLoaded", function() {
    carregarTodosCupons();
});

function agruparMovimentacoesPorCupom() {
    const movimentacoesBrutas = obterDados("movimentacoes") || {};
    const tempCuponsMap = new Map();

    for (const dataKey in movimentacoesBrutas) {
        if (Array.isArray(movimentacoesBrutas[dataKey])) {
            movimentacoesBrutas[dataKey].forEach(mov => {
                if (mov.idCupom) {
                    if (!tempCuponsMap.has(mov.idCupom)) {
                        tempCuponsMap.set(mov.idCupom, {
                            id: mov.idCupom,
                            data: mov.data || dataKey,
                            hora: mov.hora,
                            usuario: mov.usuario,
                            formaPagamento: mov.formaPagamento,
                            numeroPedido: mov.numeroPedido || 0, // <-- Lendo o pedido direto do banco
                            valorTotalVendaOriginal: 0,
                            valorTotalDevolvido: 0,
                            itensVendaOriginal: [],
                            temDevolucao: false,
                            temTroca: false,
                            temDescarte: false,
                            movimentosParaStatus: []
                        });
                    }
                    const cupomTemp = tempCuponsMap.get(mov.idCupom);
                    
                    cupomTemp.movimentosParaStatus.push(mov);

                    if (typeof mov.valor === 'number' && typeof mov.quantidade === 'number') {
                        const valorItemCalculado = mov.valor * Math.abs(mov.quantidade); 

                        if (mov.tipoMovimento === 'venda' || !mov.tipoMovimento) {
                            cupomTemp.valorTotalVendaOriginal += valorItemCalculado;
                            
                            const itemExistente = cupomTemp.itensVendaOriginal.find(item => item.codigo === mov.codigo && item.valor === mov.valor);
                            if (itemExistente) {
                                itemExistente.quantidade += mov.quantidade;
                            } else {
                                cupomTemp.itensVendaOriginal.push({
                                    codigo: mov.codigo,
                                    nome: mov.produto,
                                    valor: mov.valor,
                                    quantidade: mov.quantidade
                                });
                            }
                        } else if (mov.tipoMovimento === 'DEVOLUCAO' || mov.tipoMovimento === 'cancelado') {
                            cupomTemp.valorTotalDevolvido += valorItemCalculado;
                            cupomTemp.temDevolucao = true;
                        } else if (mov.tipoMovimento === 'TROCA') {
                            cupomTemp.temTroca = true;
                        } else if (mov.tipoMovimento === 'DESCARTE') {
                            cupomTemp.valorTotalDevolvido += valorItemCalculado;
                            cupomTemp.temDescarte = true;
                        }
                    }
                }
            });
        }
    }

    const finalCupons = [];
    tempCuponsMap.forEach(cupomTemp => {
        let status = 'Ativo';
        let valorParaDisplay = cupomTemp.valorTotalVendaOriginal;

        if (cupomTemp.temDevolucao || cupomTemp.temDescarte) {
            if (Math.abs(cupomTemp.valorTotalVendaOriginal - cupomTemp.valorTotalDevolvido) < 0.01) {
                status = 'Cancelado Totalmente';
                valorParaDisplay = 0;
            } else {
                status = 'Devolvido Parcialmente';
                valorParaDisplay = cupomTemp.valorTotalVendaOriginal - cupomTemp.valorTotalDevolvido;
            }
        } else if (cupomTemp.temTroca) {
            status = 'Troca';
        }

        const itensFiltradosParaDisplay = cupomTemp.itensVendaOriginal.filter(item => item.quantidade > 0);

        finalCupons.push({
            id: cupomTemp.id,
            data: cupomTemp.data, 
            hora: cupomTemp.hora,
            usuario: cupomTemp.usuario,
            formaPagamento: cupomTemp.formaPagamento,
            numeroPedido: cupomTemp.numeroPedido,
            valorTotal: valorParaDisplay,
            itens: itensFiltradosParaDisplay,
            status: status
        });
    });

    const cuponsParaExibir = finalCupons.filter(cupom => cupom.status !== 'Cancelado Totalmente');

    return cuponsParaExibir.sort((a, b) => {
        const dateTimeA = new Date(`${a.data}T${a.hora}`);
        const dateTimeB = new Date(`${b.data}T${b.hora}`);
        return dateTimeB.getTime() - dateTimeA.getTime();
    });
}

function abrirModalDetalhesCupom(idCupom) {
    cupomParaAcao = cuponsDisponiveis.find(cupom => cupom.id === idCupom);
    if (!cupomParaAcao) {
        alert("Cupom não encontrado.");
        return;
    }

    const detalhesBody = document.getElementById("detalhes-cupom-body");
    const valorTotalDetalhes = typeof cupomParaAcao.valorTotal === 'number' ? cupomParaAcao.valorTotal.toFixed(2) : '0.00';
    
    var configLoja = obterDados("configLoja") || { nome: "Nome da Loja", cnpj: "00.000.000/0000-00" };
    var idCurto = cupomParaAcao.id ? cupomParaAcao.id.split('-')[1] : "000000";
    var isCancelado = cupomParaAcao.status === 'Cancelado Totalmente';
    
    // Tratamento do número do pedido
    let numPedido = cupomParaAcao.numeroPedido || 0;
    let numPedidoFormatado = numPedido < 10 ? "0" + numPedido : numPedido;
    
    let cupomHTML = `
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 15px; color: #000; background: #fff; padding: 15px 10px; border: 1px solid #ccc; max-width: 280px; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1); position: relative; text-align: left;">
            
            <div style="display: block; min-height: 55px; position: relative; margin-bottom: 5px;">
                <div style="width: 170px; text-align: left;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: bold; text-transform: uppercase; line-height: 1.2;">${configLoja.nome}</h2>
                    <p style="margin: 2px 0 0 0; font-size: 11px;">CNPJ: ${configLoja.cnpj}</p>
                    <p style="margin: 2px 0 0 0; font-size: 11px;">IE: ISENTO</p>
                </div>
                <div style="position: absolute; top: 0; right: 0; border: 2px solid #000; padding: 4px 8px; text-align: center; background: #fff; min-width: 65px;">
                    <span style="font-size: 9px; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: -2px;">PEDIDO</span>
                    <span style="font-size: 26px; font-weight: bold; display: block; line-height: 1.1;">${numPedidoFormatado}</span>
                </div>
            </div>
            
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            ${isCancelado 
                ? `<p style="margin: 2px 0; text-align: center; font-size: 13px; font-weight: bold; color: #c0392b;">*** CUPOM CANCELADO ***</p>` 
                : `<p style="margin: 2px 0; text-align: center; font-size: 13px; font-weight: bold;">CUPOM NÃO FISCAL</p>`}
            
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin: 2px 0;">
                <span>Data: ${cupomParaAcao.data} - ${cupomParaAcao.hora}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin: 2px 0;">
                <span>Operador: ${cupomParaAcao.usuario}</span>
                <span>Cupom: ${idCurto}</span>
            </div>
            
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 5px 0;">
                <thead>
                    <tr>
                        <th style="border-bottom: 1px dashed #000; padding-bottom: 3px; text-align: center;">QTD</th>
                        <th style="border-bottom: 1px dashed #000; padding-bottom: 3px; text-align: left;">DESCRIÇÃO</th>
                        <th style="border-bottom: 1px dashed #000; padding-bottom: 3px; text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${cupomParaAcao.itens.map(item => {
                        const itemSubtotal = (item.valor * item.quantidade).toFixed(2);
                        return `
                        <tr>
                            <td style="padding: 3px 0; text-align: center;">${item.quantidade}</td>
                            <td style="padding: 3px 0; word-wrap: break-word;">${item.nome ? item.nome.substring(0, 18) : "Item"}</td>
                            <td style="padding: 3px 0; text-align: right;">${itemSubtotal}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            ${isCancelado 
                ? `<div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; color: #777; text-decoration: line-through;">
                       <span>TOTAL A PAGAR:</span><span>R$ ${valorTotalDetalhes}</span>
                   </div>
                   <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; color: #c0392b; margin-top: 5px;">
                       <span>VALOR ESTORNADO:</span><span>R$ ${valorTotalDetalhes}</span>
                   </div>`
                : `<div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold;">
                       <span>TOTAL A PAGAR:</span><span>R$ ${valorTotalDetalhes}</span>
                   </div>`}

            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin: 2px 0;">
                <span>FORMA PAGAMENTO:</span>
                <span>${cupomParaAcao.formaPagamento.toUpperCase()}</span>
            </div>
            
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            <p style="margin-top: 10px; font-weight: bold; text-align: center; font-size: 13px;">Obrigado pela preferência!</p>
            <p style="text-align: center; font-size: 13px;">Volte Sempre!</p>
        </div>
    `;

    detalhesBody.innerHTML = cupomHTML;
    document.getElementById("modal-detalhes-cupom").style.display = "flex";
}

function fecharModalDetalhesCupom() {
    document.getElementById("modal-detalhes-cupom").style.display = "none";
}

function abrirModalCancelamento(idCupom) {
    cupomParaAcao = cuponsDisponiveis.find(cupom => cupom.id === idCupom);
    if (!cupomParaAcao) {
        alert("Cupom não encontrado.");
        return;
    }

    if (cupomParaAcao.status === 'Cancelado Totalmente') {
        alert("Este cupom já foi totalmente cancelado e não pode ser alterado.");
        return;
    }

    const cancelCupomTotalDisplay = typeof cupomParaAcao.valorTotal === 'number' ? cupomParaAcao.valorTotal.toFixed(2) : 'N/A';
    document.getElementById("cancel-cupom-id").innerText = cupomParaAcao.id;
    document.getElementById("cancel-cupom-total").innerText = cancelCupomTotalDisplay;
    document.getElementById("senha-cancelamento").value = "";
    document.getElementById("motivo-cancelamento").value = "";

    const itensParaCancelarDiv = document.getElementById("itens-para-cancelar");
    itensParaCancelarDiv.innerHTML = "<h4>Itens do Cupom:</h4>";
    cupomParaAcao.itens.forEach((item, index) => {
        const itemDiv = document.createElement("div"); 
        const itemValorDisplay = typeof item.valor === 'number' ? item.valor.toFixed(2) : 'N/A';
        itemDiv.innerHTML = `
            <input type="checkbox" id="item-${index}" data-codigo="${item.codigo}" data-quantidade="${item.quantidade}" data-valor="${item.valor}" checked>
            <label for="item-${index}">${item.nome} (Qtd: ${item.quantidade}) - R$ ${itemValorDisplay}</label>
        `;
        itensParaCancelarDiv.appendChild(itemDiv);
    });

    document.getElementById("modal-cancelamento").style.display = "flex";
    setTimeout(() => document.getElementById("senha-cancelamento").focus(), 100);
}

function fecharModalCancelamento() {
    document.getElementById("modal-cancelamento").style.display = "none";
    cupomParaAcao = null;
}

function confirmarCancelamentoCupom() {
    const senha = document.getElementById("senha-cancelamento").value;
    const motivo = document.getElementById("motivo-cancelamento").value;

    const senhaAdmin = "2201";

    if (senha !== senhaAdmin) {
        alert("Senha de administrador incorreta!");
        return;
    }
    if (!motivo) {
        alert("Por favor, selecione um motivo para o cancelamento/devolução.");
        return;
    }
    if (!cupomParaAcao) {
        alert("Nenhum cupom selecionado para ação.");
        return;
    }

    const itensSelecionados = [];
    document.querySelectorAll('#itens-para-cancelar input[type="checkbox"]:checked').forEach(checkbox => {
        itensSelecionados.push({
            codigo: checkbox.dataset.codigo,
            quantidade: parseInt(checkbox.dataset.quantidade),
            valor: parseFloat(checkbox.dataset.valor)
        });
    });

    if (itensSelecionados.length === 0) {
        alert("Selecione ao menos um item para cancelar/devolver.");
        return;
    }

    let produtos = obterDados("produtos") || {};
    let movimentacoes = obterDados("movimentacoes") || {};
    let resumoFormas = obterDados("resumoFormas") || { Pix: 0, Crédito: 0, Débito: 0, Dinheiro: 0, Cheque: 0, VR: 0, Misto: 0 }; 
    
    const dataCancelamento = new Date();
    
    // CORREÇÃO DO FUSO HORÁRIO PARA CANCELAMENTO
    const offset = dataCancelamento.getTimezoneOffset() * 60000;
    const dataAtualFormatted = (new Date(dataCancelamento.getTime() - offset)).toISOString().split('T')[0]; 
    
    const horaAtual = dataCancelamento.toLocaleTimeString(); 
    const usuario = localStorage.getItem("usuarioLogado") || "desconhecido";

    if (!movimentacoes[dataAtualFormatted]) movimentacoes[dataAtualFormatted] = [];

    let valorTotalDevolvidoOuDescartado = 0;

    itensSelecionados.forEach(itemSelecionado => {
        const valorItem = itemSelecionado.valor * itemSelecionado.quantidade;
        
        let acaoRealizada = '';
        let quantidadeParaRegistro = itemSelecionado.quantidade; 

        if (motivo === 'devolucao') {
            if (produtos[itemSelecionado.codigo]) {
                produtos[itemSelecionado.codigo].quantidade += itemSelecionado.quantidade;
            }
            acaoRealizada = 'DEVOLUCAO';
            quantidadeParaRegistro = -itemSelecionado.quantidade;
            valorTotalDevolvidoOuDescartado += valorItem; 
        } else if (motivo === 'troca') {
            acaoRealizada = 'TROCA';
        } else if (motivo.startsWith('descarte')) {
            acaoRealizada = 'DESCARTE';
            quantidadeParaRegistro = -itemSelecionado.quantidade;
            valorTotalDevolvidoOuDescartado += valorItem; 
        }

        movimentacoes[dataAtualFormatted].push({
            idCupom: cupomParaAcao.id,
            produto: itemSelecionado.nome || `Produto ${itemSelecionado.codigo}`,
            codigo: itemSelecionado.codigo,
            quantidade: quantidadeParaRegistro, 
            valor: itemSelecionado.valor,
            tipoMovimento: acaoRealizada,
            motivo: motivo,
            usuario: usuario,
            hora: horaAtual,
            data: dataAtualFormatted 
        });
    });

    if (cupomParaAcao.formaPagamento !== 'Misto' && resumoFormas.hasOwnProperty(cupomParaAcao.formaPagamento) && typeof valorTotalDevolvidoOuDescartado === 'number') {
        resumoFormas[cupomParaAcao.formaPagamento] -= valorTotalDevolvidoOuDescartado;
        if (resumoFormas[cupomParaAcao.formaPagamento] < 0) resumoFormas[cupomParaAcao.formaPagamento] = 0; 
    } else if (cupomParaAcao.formaPagamento === 'Misto' && valorTotalDevolvidoOuDescartado > 0) {
        resumoFormas['Misto'] -= valorTotalDevolvidoOuDescartado;
        if (resumoFormas['Misto'] < 0) resumoFormas['Misto'] = 0;
    }

    salvarDados("produtos", produtos);
    salvarDados("movimentacoes", movimentacoes);
    salvarDados("resumoFormas", resumoFormas);

    alert(`Ação de '${motivo}' realizada para os itens selecionados do cupom ${cupomParaAcao.id}.`);
    fecharModalCancelamento();
    carregarTodosCupons();
}