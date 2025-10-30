import { prisma } from "../../database";
import getPageInfo from "../../helpers/getPageInfo";
import { UsuarioInput } from "../inputs/usuario";
import { Pagination } from "../inputs/Utils";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET_KEY = process.env.JWT_SECRET || "secreto";

export class UsuarioService {
  async getAll(pagination?: Pagination) {
    let pagina: number = 0;
    let quantidade: number = 10;

    try {
      if (pagination) {
        pagina = pagination.pagina ?? 0;
        quantidade = pagination.quantidade ?? 10;
      }

      const usuarios = await prisma.usuario.findMany({
        skip: pagina * quantidade,
        take: quantidade,
      });

      if (usuarios.length === 0) {
        throw new Error(`Nenhuma conta encontrada para os filtros aplicados.`);
      }

      const dataTotal = await prisma.usuario.count();
      const DataPageInfo = getPageInfo(dataTotal, pagina, quantidade);

      return { result: usuarios, pageInfo: DataPageInfo };
    } catch (error) {
      throw new Error(`Erro ao buscar usuários: ${error}`);
    }
  }

  async getById(id: number) {
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } });
      if (!usuario) {
        throw new Error(`Usuário com ID ${id} não encontrado.`);
      }
      return usuario;
    } catch (error) {
      throw new Error(`Erro ao buscar usuário: ${error}`);
    }
  }

  async create(data: UsuarioInput) {
    try {
      if (!data.email || !data.senha) {
        throw new Error("Email e senha são obrigatórios.");
      }

      // Verifica se o usuário já existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email: data.email },
      });
      if (usuarioExistente) {
        throw new Error("Já existe um usuário com este email.");
      }

      const hashedPassword = await bcrypt.hash(data.senha, 10);
      const novoUsuario = await prisma.usuario.create({
        data: { ...data, senha: hashedPassword },
      });

      return novoUsuario;
    } catch (error) {
      throw new Error(`Erro ao criar usuário: ${error}`);
    }
  }

  async update(id: number, data: Partial<UsuarioInput>) {
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } });
      if (!usuario) {
        throw new Error(`Usuário com ID ${id} não encontrado.`);
      }

      if (data.senha) {
        data.senha = await bcrypt.hash(data.senha, 10);
      }

      const usuarioAtualizado = await prisma.usuario.update({
        where: { id },
        data,
      });
      return usuarioAtualizado;
    } catch (error) {
      throw new Error(`Erro ao atualizar usuário: ${error}`);
    }
  }

  async delete(id: number) {
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } });
      if (!usuario) {
        throw new Error(`Usuário com ID ${id} não encontrado.`);
      }

      await prisma.usuario.delete({ where: { id } });
      return { message: "Usuário deletado com sucesso." };
    } catch (error) {
      throw new Error(`Erro ao deletar usuário: ${error}`);
    }
  }

  async login(email: string, senha: string) {
    try {
      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (!usuario) {
        throw new Error("Usuário ou senha inválidos.");
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        throw new Error("Usuário ou senha inválidos.");
      }

      const token = jwt.sign(
        {
          id: usuario.id,
          email: usuario.email,
          nome: usuario.nome,
          tipo: usuario.tipo,
        },
        SECRET_KEY,
        { expiresIn: "1m" } // 🔥 expira em 1 minuto
      );

      return { token }; // Retornando um objeto com a chave "token"
    } catch (error) {
      throw new Error(`Erro ao fazer login: ${error}`);
    }
  }
}
