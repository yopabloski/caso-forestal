// Rutas canónicas de Firestore para un curso. Ningún dato de estudiantes vive
// fuera de este árbol; así el mismo correo puede existir en cursos distintos.
import { validarCursoId } from './curso.js';

export function rutasCurso(cursoId) {
  const curso = validarCursoId(cursoId);
  if (!curso) throw new Error('Identificador de curso no válido.');
  const raiz = ['fcsCursos', curso];
  return {
    curso,
    raiz,
    config: [...raiz, 'config', 'sitio'],
    codigos: [...raiz, 'codigos'],
    lista: [...raiz, 'lista'],
    participantes: [...raiz, 'participantes'],
    privado: [...raiz, 'privado'],
    verificaciones: [...raiz, 'verificaciones'],
    participante: correo => [...raiz, 'participantes', correo],
    respuestas: correo => [...raiz, 'participantes', correo, 'respuestas']
  };
}
