/**
 * Seed de prueba: pobla /data/modules/*.db con Juan 3 en Español (RV1909)
 * y Griego (SBLGNT), tokenización interlineal alineada y lexicon Strongs.
 *
 * NOTAS DE CONTENIDO:
 * - RV1909 (Reina Valera 1909): texto de dominio público.
 * - Griego: basado en SBLGNT (© 2010 Society of Biblical Literature,
 *   disponible para uso libre). El módulo se llama NA28 por convención
 *   de la app; el pipeline OSIS real (scripts/import-osis.ts) reemplazará
 *   estos datos con texto NA28 verificado.
 * - Strong/morphology curados con precisión para Juan 3:16 (alineación
 *   palabra a palabra); el resto del capítulo lleva strong/lema para
 *   vocabulario conocido y alineación automática por cláusula.
 *
 * Ejecutar: bun run seed  (corre bajo Node, donde better-sqlite3 funciona)
 */
import {
  getModuleDb,
  initLexiconDb,
  initModuleDb,
  initModuleMeta,
  normalizeText,
  writeBooks,
  writeManifestMeta,
} from "../src/lib/db/sqlite.ts";
import { BOOKLIST } from "../src/lib/canon.ts";
import type Database from "better-sqlite3";

const LIBRO = "Jn";
const CAPITULO = 3;

type Token = { text: string; isPunct: boolean };
type AlignGroup = { es: number[]; gr: number[] };

const ES: string[] = [
  "Y HABIA un hombre de los Fariseos que se llamaba Nicodemo, un principal entre los Judíos.",
  "Este vino á él de noche, y díjole: Rabbí, sabemos que has venido de Dios por maestro; porque ninguno puede hacer estas señales que tú haces, si no fuere Dios con él.",
  "Respondió Jesús, y díjole: De cierto, de cierto te digo, que el que no naciere otra vez, no puede ver el reino de Dios.",
  "Nicodemo le dice: ¿Cómo puede el hombre nacer siendo viejo? ¿puede por ventura tornar á entrar en el vientre de su madre, y nacer?",
  "Respondió Jesús: De cierto, de cierto te digo, que el que no naciere de agua y del Espíritu, no puede entrar en el reino de Dios.",
  "Lo que es nacido de la carne, carne es; y lo que es nacido del Espíritu, espíritu es.",
  "No te maravilles de que te dije: Os es menester nacer otra vez.",
  "El viento de donde quiere sopla, y oyes su sonido; mas ni sabes de dónde viene, ni á dónde va: así es todo aquel que es nacido del Espíritu.",
  "Respondió Nicodemo, y díjole: ¿Cómo puede esto hacerse?",
  "Respondió Jesús, y díjole: ¿Tú eres el maestro de Israel, y no sabes esto?",
  "De cierto, de cierto te digo, que lo que sabemos hablamos, y lo que hemos visto, testificamos; y no recibís nuestro testimonio.",
  "Si os he dicho cosas terrenas, y no creéis, ¿cómo, si os dijere las celestiales, creeréis?",
  "Y nadie subió al cielo, sino el que descendió del cielo, el Hijo del hombre que está en el cielo.",
  "Y como Moisés levantó la serpiente en el desierto, así es menester que el Hijo del hombre sea levantado,",
  "para que todo aquel que en él creyere, no se pierda, mas tenga vida eterna.",
  "Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
  "Porque no envió Dios á su Hijo al mundo, para que condene al mundo, sino para que el mundo sea salvo por él.",
  "El que en él cree, no es condenado; pero el que no cree, ya es condenado, porque no creyó en el nombre del unigénito Hijo de Dios.",
  "Y esta es la condenación: porque la luz vino al mundo, y los hombres amaron más las tinieblas que la luz, porque sus obras eran malas.",
  "Porque todo aquel que hace lo malo, aborrece la luz, y no viene á la luz, porque sus obras no sean redargüidas.",
  "Mas el que obra verdad, viene á la luz, para que sus obras sean manifiestas; porque son hechas en Dios.",
  "Después de esto vino Jesús con sus discípulos á la tierra de Judea; y estaba allí con ellos, y bautizaba.",
  "Y bautizaba también Juan en Enón junto á Salim, porque había allí muchas aguas; y venían, y eran bautizados.",
  "Porque Juan no había sido aún puesto en la cárcel.",
  "Y hubo cuestión entre los discípulos de Juan y los Judíos acerca de la purificación.",
  "Y vinieron á Juan, y dijéronle: Rabbí, el que estaba contigo de la otra parte del Jordán, del cual diste tú testimonio, he aquí bautiza, y todos vienen á él.",
  "Respondió Juan, y dijo: No puede el hombre recibir algo, si no le fuere dado del cielo.",
  "Vosotros mismos me sois testigos de que dije: Yo no soy el Cristo, sino que soy enviado delante de él.",
  "El que tiene la esposa, es el esposo; mas el amigo del esposo, que está en pie y le oye, se goza grandemente de la voz del esposo: así pues, este mi gozo es cumplido.",
  "A él conviene crecer, mas á mí menguar.",
  "El que de arriba viene, es sobre todos: el que es de la tierra, es de la tierra, y de la tierra habla: el que viene del cielo, es sobre todos.",
  "Y lo que vió y oyó, esto testifica; y ninguno recibe su testimonio.",
  "El que recibió su testimonio, éste selló que Dios es verdadero.",
  "Porque aquel á quien Dios envió, las palabras de Dios habla: porque no da Dios el Espíritu por medida.",
  "El Padre ama al Hijo, y todas las cosas dió en su mano.",
  "El que cree en el Hijo, tiene vida eterna; mas el que es incrédulo al Hijo, no verá la vida, sino que la ira de Dios está sobre él.",
];

const GR: string[] = [
  "Ἦν δὲ ἄνθρωπος ἐκ τῶν Φαρισαίων, Νικόδημος ὄνομα αὐτῷ, ἄρχων τῶν Ἰουδαίων·",
  "οὗτος ἦλθεν πρὸς αὐτὸν νυκτὸς καὶ εἶπεν αὐτῷ· ῥαββί, οἴδαμεν ὅτι ἀπὸ θεοῦ ἐλήλυθας διδάσκαλος· οὐδεὶς γὰρ δύναται ταῦτα τὰ σημεῖα ποιεῖν ἃ σὺ ποιεῖς, ἐὰν μὴ ᾖ ὁ θεὸς μετʼ αὐτοῦ.",
  "ἀπεκρίθη ὁ Ἰησοῦς καὶ εἶπεν αὐτῷ· ἀμὴν ἀμὴν λέγω σοι, ἐὰν μή τις γεννηθῇ ἄνωθεν, οὐ δύναται ἰδεῖν τὴν βασιλείαν τοῦ θεοῦ.",
  "λέγει πρὸς αὐτὸν ὁ Νικόδημος· πῶς δύναται ἄνθρωπος γεννηθῆναι γέρων ὤν; μὴ δύναται εἰς τὴν κοιλίαν τῆς μητρὸς αὐτοῦ δεύτερον εἰσελθεῖν καὶ γεννηθῆναι;",
  "ἀπεκρίθη ὁ Ἰησοῦς· ἀμὴν ἀμὴν λέγω σοι, ἐὰν μή τις γεννηθῇ ἐξ ὕδατος καὶ πνεύματος, οὐ δύναται εἰσελθεῖν εἰς τὴν βασιλείαν τοῦ θεοῦ.",
  "τὸ γεγεννημένον ἐκ τῆς σαρκὸς σάρξ ἐστιν, καὶ τὸ γεγεννημένον ἐκ τοῦ πνεύματος πνεῦμά ἐστιν.",
  "μὴ θαυμάσῃς ὅτι εἶπόν σοι· δεῖ ὑμᾶς γεννηθῆναι ἄνωθεν.",
  "τὸ πνεῦμα ὅπου θέλει πνεῖ καὶ τὴν φωνὴν αὐτοῦ ἀκούεις, ἀλλʼ οὐκ οἶδας πόθεν ἔρχεται καὶ ποῦ ὑπάγει· οὕτως ἐστὶν πᾶς ὁ γεγεννημένος ἐκ τοῦ πνεύματος.",
  "ἀπεκρίθη Νικόδημος καὶ εἶπεν αὐτῷ· πῶς δύναται ταῦτα γενέσθαι;",
  "ἀπεκρίθη ὁ Ἰησοῦς καὶ εἶπεν αὐτῷ· σὺ εἶ ὁ διδάσκαλος τοῦ Ἰσραὴλ καὶ ταῦτα οὐ γινώσκεις;",
  "ἀμὴν ἀμὴν λέγω σοι ὅτι ὃ οἴδαμεν λαλοῦμεν καὶ ὃ ἑωράκαμεν μαρτυροῦμεν, καὶ τὴν μαρτυρίαν ἡμῶν οὐ λαμβάνετε.",
  "εἰ τὰ ἐπίγεια εἶπον ὑμῖν καὶ οὐ πιστεύετε, πῶς ἐὰν εἴπω ὑμῖν τὰ ἐπουράνια πιστεύσετε;",
  "καὶ οὐδεὶς ἀναβέβηκεν εἰς τὸν οὐρανὸν εἰ μὴ ὁ ἐκ τοῦ οὐρανοῦ καταβάς, ὁ υἱὸς τοῦ ἀνθρώπου.",
  "καὶ καθὼς Μωϋσῆς ὕψωσεν τὸν ὄφιν ἐν τῇ ἐρήμῳ, οὕτως ὑψωθῆναι δεῖ τὸν υἱὸν τοῦ ἀνθρώπου,",
  "ἵνα πᾶς ὁ πιστεύων ἐν αὐτῷ ἔχῃ ζωὴν αἰώνιον.",
  "οὕτως γὰρ ἠγάπησεν ὁ θεὸς τὸν κόσμον, ὥστε τὸν υἱὸν τὸν μονογενῆ ἔδωκεν, ἵνα πᾶς ὁ πιστεύων εἰς αὐτὸν μὴ ἀπόληται ἀλλὰ ἔχῃ ζωὴν αἰώνιον.",
  "οὐ γὰρ ἀπέστειλεν ὁ θεὸς τὸν υἱὸν εἰς τὸν κόσμον ἵνα κρίνῃ τὸν κόσμον, ἀλλʼ ἵνα σωθῇ ὁ κόσμος διʼ αὐτοῦ.",
  "ὁ πιστεύων εἰς αὐτὸν οὐ κρίνεται· ὁ μὴ πιστεύων ἤδη κέκριται, ὅτι μὴ πεπίστευκεν εἰς τὸ ὄνομα τοῦ μονογενοῦς υἱοῦ τοῦ θεοῦ.",
  "αὕτη δέ ἐστιν ἡ κρίσις ὅτι τὸ φῶς ἐλήλυθεν εἰς τὸν κόσμον καὶ ἠγάπησαν οἱ ἄνθρωποι μᾶλλον τὸ σκότος ἢ τὸ φῶς, ἦν γὰρ αὐτῶν πονηρὰ τὰ ἔργα.",
  "πᾶς γὰρ ὁ φαῦλα πράσσων μισεῖ τὸ φῶς καὶ οὐκ ἔρχεται πρὸς τὸ φῶς, ἵνα μὴ ἐλεγχθῇ τὰ ἔργα αὐτοῦ·",
  "ὁ δὲ ποιῶν τὴν ἀλήθειαν ἔρχεται πρὸς τὸ φῶς, ἵνα φανερωθῇ αὐτοῦ τὰ ἔργα ὅτι ἐν θεῷ ἐστιν εἰργασμένα.",
  "Μετὰ ταῦτα ἦλθεν ὁ Ἰησοῦς καὶ οἱ μαθηταὶ αὐτοῦ εἰς τὴν Ἰουδαίαν γῆν, καὶ ἐκεῖ διέτριβεν μετʼ αὐτῶν καὶ ἐβάπτιζεν.",
  "ἦν δὲ καὶ ὁ Ἰωάννης βαπτίζων ἐν Αἰνὼν ἐγγὺς τοῦ Σαλείμ, ὅτι ὕδατα πολλὰ ἦν ἐκεῖ, καὶ παρεγίνοντο καὶ ἐβαπτίζοντο·",
  "οὔπω γὰρ ἦν βεβλημένος εἰς τὴν φυλακὴν ὁ Ἰωάννης.",
  "Ἐγένετο οὖν ζήτησις ἐκ τῶν μαθητῶν Ἰωάννου μετὰ Ἰουδαίου περὶ καθαρισμοῦ.",
  "καὶ ἦλθον πρὸς τὸν Ἰωάννην καὶ εἶπαν αὐτῷ· ῥαββί, ὃς ἦν μετὰ σοῦ πέραν τοῦ Ἰορδάνου, ᾧ σὺ μεμαρτύρηκας, ἴδε οὗτος βαπτίζει καὶ πάντες ἔρχονται πρὸς αὐτόν.",
  "ἀπεκρίθη ὁ Ἰωάννης καὶ εἶπεν· οὐ δύναται ἄνθρωπος λαμβάνειν οὐδὲ ἓν ἐὰν μὴ ᾖ δεδομένον αὐτῷ ἐκ τοῦ οὐρανοῦ.",
  "αὐτοὶ ὑμεῖς μοι μαρτυρεῖτε ὅτι εἶπον· οὐκ εἰμὶ ἐγὼ ὁ χριστός, ἀλλʼ ὅτι ἀπεσταλμένος εἰμὶ ἔμπροσθεν ἐκείνου.",
  "ὁ ἔχων τὴν νύμφην νυμφίος ἐστίν· ὁ δὲ φίλος τοῦ νυμφίου ὁ ἑστὼς καὶ ἀκούων αὐτοῦ χαρᾷ χαίρει διὰ τὴν φωνὴν τοῦ νυμφίου. αὕτη οὖν ἡ χαρὰ ἡ ἐμὴ πεπλήρωται.",
  "ἐκεῖνον δεῖ αὐξάνειν, ἐμὲ δὲ ἐλαττοῦσθαι.",
  "ὁ ἄνωθεν ἐρχόμενος ἐπάνω πάντων ἐστίν· ὁ ὢν ἐκ τῆς γῆς ἐκ τῆς γῆς ἐστιν καὶ ἐκ τῆς γῆς λαλεῖ. ὁ ἐκ τοῦ οὐρανοῦ ἐρχόμενος ἐπάνω πάντων ἐστίν.",
  "ὃ ἑώρακεν καὶ ἤκουσεν τοῦτο μαρτυρεῖ, καὶ τὴν μαρτυρίαν αὐτοῦ οὐδεὶς λαμβάνει.",
  "ὁ λαβὼν αὐτοῦ τὴν μαρτυρίαν ἐσφράγισεν ὅτι ὁ θεὸς ἀληθής ἐστιν.",
  "ὃν γὰρ ἀπέστειλεν ὁ θεὸς τὰ ῥήματα τοῦ θεοῦ λαλεῖ, οὐ γὰρ ἐκ μέτρου δίδωσιν τὸ πνεῦμα.",
  "ὁ πατὴρ ἀγαπᾷ τὸν υἱὸν καὶ πάντα δέδωκεν ἐν τῇ χειρὶ αὐτοῦ.",
  "ὁ πιστεύων εἰς τὸν υἱὸν ἔχει ζωὴν αἰώνιον· ὁ δὲ ἀπειθῶν τῷ υἱῷ οὐκ ὄψεται ζωήν, ἀλλʼ ἡ ὀργὴ τοῦ θεοῦ μένει ἐπʼ αὐτόν.",
];

/** strong_id por forma superficial normalizada (sin acentos). Las claves con acento se resuelven exactas primero. */
const STRONG_MAP: Record<string, string> = {
  "ὃ": "G3739", "ᾧ": "G3739", "ὃν": "G3739", "ἃ": "G3739", "ὃς": "G3739",
  ο: "G3588", η: "G3588", το: "G3588", τον: "G3588", την: "G3588", του: "G3588",
  τη: "G3588", τας: "G3588", τους: "G3588", τα: "G3588", τω: "G3588", τοις: "G3588",
  αμην: "G281", ην: "G1510", ει: "G1510", εστιν: "G1510", εστι: "G1510", εστ: "G1510",
  ειναι: "G1510", ημην: "G1510", ημειθα: "G1510", ω: "G1510", ων: "G1510", ουσα: "G1510",
  ηλθεν: "G2064", ηλθον: "G2064", εληλυθας: "G2064", εληλυθεν: "G2064", ερχεται: "G2064",
  ερχονται: "G2064", ερχομενος: "G2064", ελθειν: "G2064",
  εγενετο: "G1096",
  καθως: "G2531",
  και: "G2532", δε: "G1161", γαρ: "G1063", αλλα: "G235", αλλ: "G235",
  μη: "G3361", ου: "G3756", ουκ: "G3756", ουχ: "G3756",
  ουδεις: "G3762", ουδεν: "G3762", ουδε: "G3761", ουπω: "G3768",
  εαν: "G1437", ινα: "G2443", οτι: "G3754", ωστε: "G5620", ουν: "G3767",
  "αυτω": "G846", "αυτον": "G846", "αυτου": "G846", "αυτην": "G846",
  "αυτης": "G846", "αυτοις": "G846", "αυτων": "G846", "αυτο": "G846",
  "αυτοι": "G846", "αυτος": "G846", "εαυτου": "G1438",
  θεος: "G2316", θεου: "G2316", θεω: "G2316", θεον: "G2316",
  ιησους: "G2424", ιησου: "G2424", ιησουν: "G2424",
  ιουδαιος: "G2453", ιουδαιων: "G2453", ιουδαιου: "G2453", ιουδαιαν: "G2449",
  φαρισαιων: "G5330", νικοδημος: "G3530", ιωαννης: "G2491", ιωαννου: "G2491", ιωαννην: "G2491",
  ανθρωπος: "G444", ανθρωπου: "G444", ανθρωπον: "G444", ανθρωποι: "G444",
  ονομα: "G3686",
  οιδαμεν: "G1492", οιδας: "G1492", ηδει: "G1492",
  διδασκαλος: "G1320", γινωσκεις: "G1097",
  σημεια: "G4592", σημειον: "G4592",
  ποιειν: "G4160", ποιεις: "G4160", ποιων: "G4160", ποιησαι: "G4160", ποιησων: "G4160",
  εγω: "G1473", μου: "G1473", μοι: "G1473", με: "G1473", εμου: "G1473",
  συ: "G4771", σου: "G4771", σοι: "G4771", σε: "G4771", υμεις: "G4771", υμων: "G4771",
  υμιν: "G4771", υμας: "G4771",
  ουτος: "G3778", αυτη: "G3778", ταυτα: "G3778", τουτο: "G3778", ταυτην: "G3778",
  εκεινος: "G1565", εκεινου: "G1565", εκεινην: "G1565",
  τις: "G5100", τι: "G5100", τινες: "G5100",
  γεννηθη: "G1080", γεννηθηναι: "G1080", γεγεννημενον: "G1080", γεγεννημενος: "G1080",
  ανωθεν: "G509", ιδειν: "G3708", οψεται: "G3708", εωρακαμεν: "G3708", εωρακεν: "G3708",
  βασιλειαν: "G932", πνευματος: "G4151", πνευμα: "G4151",
  πνευματι: "G4151", υδατος: "G5204", υδατα: "G5204",
  σαρκος: "G4561", σαρξ: "G4561",
  θαυμασης: "G2296", δει: "G1163", θελει: "G2309", πνει: "G4154",
  φωνην: "G5456", φωνης: "G5456", ακουεις: "G191", ακουων: "G191", ηκουσεν: "G191",
  ποθεν: "G4159", που: "G4226", υπαγει: "G5217",
  ουτως: "G3779", παντα: "G3956", παντες: "G3956", παντων: "G3956", παν: "G3956",
  "πας": "G3956", "παντι": "G3956",
  λαλομεν: "G2980", λαλει: "G2980", λαλων: "G2980",
  μαρτυρουμεν: "G3140", μαρτυρει: "G3140", μαρτυρειτε: "G3140", μεμαρτυρηκας: "G3140",
  μαρτυριαν: "G3141",
  λαμβανετε: "G2983", λαμβανει: "G2983", λαβων: "G2983", λαμβανειν: "G2983",
  επιγεια: "G1919", επουρανια: "G2032",
  πιστευετε: "G4100", πιστευσετε: "G4100", πιστευων: "G4100", πεπιστευκεν: "G4100",
  αναβεβηκεν: "G305", ουρανον: "G3772", ουρανου: "G3772",
  καταβας: "G2597", υιος: "G5207", υιον: "G5207", υιου: "G5207", υιω: "G5207",
  μωυσης: "G3475", υψωσεν: "G5312", υψωθηναι: "G5312",
  οφιν: "G3789", ερημω: "G2048",
  εχη: "G2192", εχει: "G2192", εχων: "G2192", εχω: "G2192",
  ζωην: "G2222", ζωη: "G2222", αιωνιον: "G166",
  ηγαπησεν: "G25", ηγαπησαν: "G25",
  κοσμον: "G2889", κοσμος: "G2889", κοσμου: "G2889", κοσμω: "G2889",
  μονογενη: "G3439", μονογενους: "G3439",
  εδωκεν: "G1325", δεδωκεν: "G1325", διδωσιν: "G1325", δεδομενον: "G1325",
  αποληται: "G622", κρινη: "G2919", κρινεται: "G2919", κεκριται: "G2919",
  κρισις: "G2920", σωθη: "G4982", δι: "G1223", δια: "G1223",
  ηδη: "G2235", φως: "G5457", "ἢ": "G2228", μαλλον: "G3123", σκοτος: "G4655",
  πονηρα: "G4190", εργα: "G2041", εργον: "G2041", φαυλα: "G5337",
  πρασσων: "G4238", μισει: "G3404", ελεγχθη: "G1651",
  αληθειαν: "G225", φανερωθη: "G5319", ειργασμενα: "G2038",
  μαθηται: "G3101", μαθητων: "G3101", γην: "G1093", γης: "G1093",
  διετριβεν: "G1304", εβαπτιζεν: "G907", βαπτιζων: "G907", βαπτιζει: "G907",
  εβαπτιζοντο: "G907", αινον: "G137", εγγυς: "G1451", σαλειμ: "G4530",
  πολλα: "G4183", παρεγινοντο: "G3854", βεβλημενος: "G906",
  φυλακην: "G5438", ζητησις: "G2214", καθαρισμου: "G2512",
  περαν: "G4008", ιορδανου: "G2446", ιδε: "G2396",  εμπροσθεν: "G1715", νυμφην: "G3565", νυμφιος: "G3566", νυμφιου: "G3566",
  εστως: "G2476", χαρα: "G5479", χαρη: "G5479", χαρει: "G5479",
  χαιρει: "G5463", πεπληρωται: "G4137", αυξανειν: "G837", ελαττουσθαι: "G1642",
  επανω: "G1883", ρηματα: "G4487", μετρου: "G3358",
  πατηρ: "G3962", αγαπα: "G25", χειρι: "G5495",
  απειθων: "G544", οργη: "G3709", μενει: "G3306", επ: "G1909", επι: "G1909",
  νυκτος: "G3571", αρχων: "G758", κοιλιαν: "G2836", μητρος: "G3384",
  γερων: "G1088", δευτερον: "G1208", εισελθειν: "G1525",
  εξ: "G1537", εκ: "G1537", εν: "G1722", εις: "G1519", απο: "G575", προς: "G4314",
  μετα: "G3326", μετ: "G3326", περι: "G4012", ισραηλ: "G2474",
  οπου: "G3699", "ἓν": "G1520",
  δυναται: "G1410", δυνασθαι: "G1410", δυνηται: "G1410", δυναμει: "G1411",
  πως: "G4459", γενεσθαι: "G1096", γεγονεν: "G1096",
  απεκριθη: "G611", ειπεν: "G3004", ειπαν: "G3004", ειπον: "G3004",
  λεγω: "G3004", λεγει: "G3004", ειπω: "G3004", ειπης: "G3004",
};

/** Alineación palabra a palabra de Juan 3:16 (índices de tokens de ES y GR). */
const V16_ALIGN: AlignGroup[] = [
  { es: [0], gr: [1] },
  { es: [1, 2, 3], gr: [0] },
  { es: [4], gr: [2] },
  { es: [5], gr: [3, 4] },
  { es: [6, 7], gr: [5, 6] },
  { es: [8], gr: [7] },
  { es: [9], gr: [8] },
  { es: [10, 11], gr: [13] },
  { es: [12, 13, 14], gr: [9, 10, 11] },
  { es: [15], gr: [12] },
  { es: [16], gr: [14] },
  { es: [17, 18], gr: [15] },
  { es: [19, 20, 21], gr: [16, 17, 18] },
  { es: [22, 23, 24], gr: [19, 20] },
  { es: [25], gr: [] },
  { es: [26, 27, 28], gr: [21, 22] },
  { es: [29], gr: [] },
  { es: [30], gr: [23] },
  { es: [31], gr: [24] },
  { es: [32, 33], gr: [25, 26] },
  { es: [34], gr: [27] },
];

type LexiconEntry = {
  strong: string;
  lema: string;
  translit: string;
  pron?: string;
  def: string;
  def_det?: string;
  dominio?: string;
};

const LEXICON: LexiconEntry[] = [
  { strong: "G3588", lema: "ὁ, ἡ, τό", translit: "ho, hē, to", def: "El artículo definido: el, la, lo, los, las.", dominio: "Partículas y conectivos" },
  { strong: "G2588", lema: "καρδία", translit: "kardia", def: "Corazón; centro del ser interior: pensamientos, afectos y voluntad.", dominio: "Ser humano — interioridad" },
  { strong: "G15", lema: "ἀγαθοποιέω", translit: "agathopoieō", def: "Hacer el bien; obrar rectamente.", dominio: "Ética y conducta" },
  { strong: "G2316", lema: "θεός", translit: "theos", def: "Dios; el Dios supremo y verdadero (con artículo: el Dios).", dominio: "Divinidad" },
  { strong: "G2424", lema: "Ἰησοῦς", translit: "Iēsous", def: "Jesús; del hebreo Yehoshúa, 'Yahvé es salvación'.", dominio: "Nombres propios" },
  { strong: "G2491", lema: "Ἰωάννης", translit: "Iōannēs", def: "Juan; del hebreo Yojanán, 'Yahvé ha sido misericordioso'.", dominio: "Nombres propios" },
  { strong: "G5207", lema: "υἱός", translit: "huios", def: "Hijo; descendiente; fig. el que participa de la naturaleza o causa de otro.", dominio: "Relaciones familiares" },
  { strong: "G3439", lema: "μονογενής", translit: "monogenēs", def: "Unigénito; único de su clase, singular, el único hijo.", dominio: "Relaciones familiares" },
  { strong: "G2889", lema: "κόσμος", translit: "kosmos", def: "Mundo; universo creado; también la humanidad y el orden mundano opuesto a Dios.", dominio: "Mundo y creación" },
  { strong: "G25", lema: "ἀγαπάω", translit: "agapaō", def: "Amar; amor de elección y entrega, del tipo del amor de Dios.", dominio: "Relaciones interpersonales" },
  { strong: "G4100", lema: "πιστεύω", translit: "pisteuō", def: "Creer; confiar, poner la fe en alguien; ser persuadido de la verdad.", dominio: "Actividad mental" },
  { strong: "G622", lema: "ἀπόλλυμι", translit: "apollymi", def: "Perder, destruir; perecer, estar perdido (eternamente).", dominio: "Posesión y destrucción" },
  { strong: "G2192", lema: "ἔχω", translit: "echō", def: "Tener, poseer; mantener, sostener.", dominio: "Posesión" },
  { strong: "G2222", lema: "ζωή", translit: "zōē", def: "Vida; existencia; en Juan, la vida eterna y plena en comunión con Dios.", dominio: "Vida y existencia" },
  { strong: "G166", lema: "αἰώνιος", translit: "aiōnios", def: "Eterno; que pertenece a la era venidera, sin fin, duradero.", dominio: "Tiempo" },
  { strong: "G1510", lema: "εἰμί", translit: "eimi", def: "Ser, existir; el verbo de existencia y cópula.", dominio: "Ser y existencia" },
  { strong: "G3004", lema: "λέγω", translit: "legō", def: "Decir, hablar; llamar, nombrar; afirmar.", dominio: "Comunicación" },
  { strong: "G3056", lema: "λόγος", translit: "logos", def: "Palabra, discurso, razón; en Juan, la Palabra divina preexistente.", dominio: "Comunicación" },
  { strong: "G4151", lema: "πνεῦμα", translit: "pneuma", def: "Espíritu; viento, aliento; el Espíritu de Dios; el espíritu humano.", dominio: "Mundo espiritual" },
  { strong: "G5204", lema: "ὕδωρ", translit: "hydōr", def: "Agua.", dominio: "Mundo físico" },
  { strong: "G444", lema: "ἄνθρωπος", translit: "anthrōpos", def: "Hombre, ser humano; la humanidad.", dominio: "Ser humano" },
  { strong: "G932", lema: "βασιλεία", translit: "basileia", def: "Reino; reinado, soberanía; el gobierno real de Dios.", dominio: "Reino de Dios" },
  { strong: "G4561", lema: "σάρξ", translit: "sarx", def: "Carne; la naturaleza humana (en su debilidad y pecado).", dominio: "Ser humano — corporeidad" },
  { strong: "G5457", lema: "φῶς", translit: "phōs", def: "Luz; fig. verdad, pureza, revelación de Dios.", dominio: "Luz y tinieblas" },
  { strong: "G4655", lema: "σκότος", translit: "skotos", def: "Tinieblas; fig. pecado, ignorancia, maldad.", dominio: "Luz y tinieblas" },
  { strong: "G2041", lema: "ἔργον", translit: "ergon", def: "Obra, acción, hecho; producto del trabajo.", dominio: "Trabajo y acción" },
  { strong: "G4190", lema: "πονηρός", translit: "ponēros", def: "Malvado, maligno; malo (de carácter o calidad).", dominio: "Ética y conducta" },
  { strong: "G1492", lema: "οἶδα", translit: "oida", def: "Saber, conocer (por percepción o información); entender.", dominio: "Actividad mental" },
  { strong: "G1097", lema: "γινώσκω", translit: "ginōskō", def: "Conocer; llegar a saber; conocer personalmente.", dominio: "Actividad mental" },
  { strong: "G2064", lema: "ἔρχομαι", translit: "erchomai", def: "Venir, ir; llegar.", dominio: "Movimiento" },
  { strong: "G1410", lema: "δύναμαι", translit: "dynamai", def: "Poder, ser capaz; tener poder o autoridad.", dominio: "Poder y habilidad" },
  { strong: "G1080", lema: "γεννάω", translit: "gennaō", def: "Engendrar, dar a luz; nacer; fig. causar algo.", dominio: "Ciclo de vida" },
  { strong: "G3708", lema: "ὁράω", translit: "horaō", def: "Ver, mirar; percibir; conocer por experiencia.", dominio: "Percepción" },
  { strong: "G191", lema: "ἀκούω", translit: "akouō", def: "Oír, escuchar; entender; atender.", dominio: "Percepción" },
  { strong: "G4160", lema: "ποιέω", translit: "poieō", def: "Hacer, producir; practicar; causar.", dominio: "Trabajo y acción" },
  { strong: "G2919", lema: "κρίνω", translit: "krinō", def: "Juzgar, decidir; condenar; distinguir.", dominio: "Justicia y ley" },
  { strong: "G2920", lema: "κρίσις", translit: "krisis", def: "Juicio; proceso de juzgar; sentencia condenatoria.", dominio: "Justicia y ley" },
  { strong: "G4982", lema: "σῴζω", translit: "sōzō", def: "Salvar; preservar de peligro o destrucción; dar salvación.", dominio: "Salvación" },
  { strong: "G2983", lema: "λαμβάνω", translit: "lambanō", def: "Tomar, recibir; aceptar; obtener.", dominio: "Posesión" },
  { strong: "G1325", lema: "δίδωμι", translit: "didōmi", def: "Dar; otorgar; entregar.", dominio: "Posesión" },
  { strong: "G2980", lema: "λαλέω", translit: "laleō", def: "Hablar, decir; emitir sonido.", dominio: "Comunicación" },
  { strong: "G3140", lema: "μαρτυρέω", translit: "martyreō", def: "Dar testimonio; atestiguar; ser testigo.", dominio: "Comunicación" },
  { strong: "G3141", lema: "μαρτυρία", translit: "martyria", def: "Testimonio; evidencia, declaración de testigo.", dominio: "Comunicación" },
  { strong: "G3956", lema: "πᾶς, πᾶσα, πᾶν", translit: "pas, pasa, pan", def: "Todo, cada; entero; todos (totalidad).", dominio: "Cuantificadores" },
  { strong: "G1537", lema: "ἐκ", translit: "ek", def: "De, desde; fuera de; por causa de (origen).", dominio: "Partículas y conectivos" },
  { strong: "G1519", lema: "εἰς", translit: "eis", def: "Hacia, a, en (dirección, meta, propósito).", dominio: "Partículas y conectivos" },
  { strong: "G1722", lema: "ἐν", translit: "en", def: "En, dentro de; con (posición o instrumento).", dominio: "Partículas y conectivos" },
  { strong: "G575", lema: "ἀπό", translit: "apo", def: "De, desde (separación, origen, punto de partida).", dominio: "Partículas y conectivos" },
  { strong: "G4314", lema: "πρός", translit: "pros", def: "Hacia, a; con (relación, dirección).", dominio: "Partículas y conectivos" },
  { strong: "G3326", lema: "μετά", translit: "meta", def: "Con; después de (compañía o sucesión).", dominio: "Partículas y conectivos" },
  { strong: "G1223", lema: "διά", translit: "dia", def: "Por medio de, por; a través de (causa, instrumento).", dominio: "Partículas y conectivos" },
  { strong: "G1909", lema: "ἐπί", translit: "epi", def: "Sobre, en, contra (posición, base, autoridad).", dominio: "Partículas y conectivos" },
  { strong: "G2532", lema: "καί", translit: "kai", def: "Y, también, incluso; además.", dominio: "Partículas y conectivos" },
  { strong: "G1161", lema: "δέ", translit: "de", def: "Pero, y, ahora bien (partícula adversativa o de transición).", dominio: "Partículas y conectivos" },
  { strong: "G1063", lema: "γάρ", translit: "gar", def: "Porque, pues (partícula causal explicativa).", dominio: "Partículas y conectivos" },
  { strong: "G235", lema: "ἀλλά", translit: "alla", def: "Pero, sino, sino que (adversativa fuerte).", dominio: "Partículas y conectivos" },
  { strong: "G3361", lema: "μή", translit: "mē", def: "No (negación subjetiva, condicional, prohibitiva).", dominio: "Partículas y conectivos" },
  { strong: "G3756", lema: "οὐ", translit: "ou", def: "No (negación objetiva e indicativa).", dominio: "Partículas y conectivos" },
  { strong: "G2443", lema: "ἵνα", translit: "hina", def: "Para que, a fin de que (finalidad); que (complemento).", dominio: "Partículas y conectivos" },
  { strong: "G3754", lema: "ὅτι", translit: "hoti", def: "Que; porque (causal o de contenido).", dominio: "Partículas y conectivos" },
  { strong: "G3779", lema: "οὕτως", translit: "houtōs", def: "Así, de esta manera; de tal modo.", dominio: "Partículas y conectivos" },
  { strong: "G5620", lema: "ὥστε", translit: "hōste", def: "Así que, de modo que (resultado o consecuencia).", dominio: "Partículas y conectivos" },
  { strong: "G509", lema: "ἄνωθεν", translit: "anōthen", def: "Desde arriba; otra vez, de nuevo; desde el principio.", dominio: "Lugar y dirección" },
  { strong: "G2048", lema: "ἔρημος", translit: "erēmos", def: "Desierto; lugar desolado; fig. soledad.", dominio: "Lugar y dirección" },
  { strong: "G3789", lema: "ὄφις", translit: "ophis", def: "Serpiente.", dominio: "Animales" },
  { strong: "G305", lema: "ἀναβαίνω", translit: "anabainō", def: "Subir, ascender; ir hacia arriba.", dominio: "Movimiento" },
  { strong: "G2597", lema: "καταβαίνω", translit: "katabainō", def: "Descender, bajar.", dominio: "Movimiento" },
  { strong: "G3772", lema: "οὐρανός", translit: "ouranos", def: "Cielo; cielo atmosférico y cielo de Dios.", dominio: "Mundo físico" },
  { strong: "G3686", lema: "ὄνομα", translit: "onoma", def: "Nombre; fama, reputación; la persona misma.", dominio: "Comunicación" },
  { strong: "G1320", lema: "διδάσκαλος", translit: "didaskalos", def: "Maestro; instructor; título de Jesús.", dominio: "Educación y aprendizaje" },
  { strong: "G3101", lema: "μαθητής", translit: "mathētēs", def: "Discípulo; aprendiz, seguidor.", dominio: "Educación y aprendizaje" },
  { strong: "G5530", lema: "χράομαι", translit: "chraomai", def: "Usar; tratar con; comportarse.", dominio: "Uso y práctica" },
  { strong: "G3962", lema: "πατήρ", translit: "patēr", def: "Padre; progenitor; el Padre celestial.", dominio: "Relaciones familiares" },
  { strong: "G5495", lema: "χείρ", translit: "cheir", def: "Mano; poder, autoridad.", dominio: "Partes del cuerpo" },
  { strong: "G3709", lema: "ὀργή", translit: "orgē", def: "Ira; cólera; la ira de Dios como juicio.", dominio: "Emociones" },
  { strong: "G544", lema: "ἀπειθέω", translit: "apeitheō", def: "Desobedecer; ser incrédulo; rechazar la fe.", dominio: "Ética y conducta" },
  { strong: "G3306", lema: "μένω", translit: "menō", def: "Permanecer, quedarse; continuar; morar.", dominio: "Estado y continuidad" },
  { strong: "G3767", lema: "οὖν", translit: "oun", def: "Por tanto, entonces, así que.", dominio: "Partículas y conectivos" },
  { strong: "G227", lema: "ἀληθής", translit: "alēthēs", def: "Verdadero, genuino, real; veraz.", dominio: "Verdad y falsedad" },
  { strong: "G225", lema: "ἀλήθεια", translit: "alētheia", def: "Verdad; realidad; fidelidad.", dominio: "Verdad y falsedad" },
  { strong: "G4972", lema: "σφραγίζω", translit: "sphragizō", def: "Sellar; marcar como propiedad o certificación.", dominio: "Comercio y ley" },
  { strong: "G137", lema: "Αἰνών", translit: "Ainōn", def: "Enón; lugar al este del Jordán donde bautizó Juan.", dominio: "Nombres propios" },
  { strong: "G4530", lema: "Σαλείμ", translit: "Saleim", def: "Salim; lugar cerca de Enón.", dominio: "Nombres propios" },
  { strong: "G2446", lema: "Ἰορδάνης", translit: "Iordanēs", def: "Jordán; el río principal de Palestina.", dominio: "Nombres propios" },
  { strong: "G2474", lema: "Ἰσραήλ", translit: "Israēl", def: "Israel; 'el que lucha con Dios'; el pueblo de Dios.", dominio: "Nombres propios" },
  { strong: "G3475", lema: "Μωϋσῆς", translit: "Mōusēs", def: "Moisés; el legislador de Israel.", dominio: "Nombres propios" },
];

const PARSING: { code: string; desc: string; cat: string }[] = [
  { code: "N-NSM", desc: "Sustantivo, nominativo singular masculino", cat: "Sustantivo" },
  { code: "N-ASM", desc: "Sustantivo, acusativo singular masculino", cat: "Sustantivo" },
  { code: "N-ASF", desc: "Sustantivo, acusativo singular femenino", cat: "Sustantivo" },
  { code: "N-GSM", desc: "Sustantivo, genitivo singular masculino", cat: "Sustantivo" },
  { code: "N-DSF", desc: "Sustantivo, dativo singular femenino", cat: "Sustantivo" },
  { code: "T-NSM", desc: "Artículo, nominativo singular masculino", cat: "Artículo" },
  { code: "T-ASM", desc: "Artículo, acusativo singular masculino", cat: "Artículo" },
  { code: "T-GSF", desc: "Artículo, genitivo singular femenino", cat: "Artículo" },
  { code: "A-ASM", desc: "Adjetivo, acusativo singular masculino", cat: "Adjetivo" },
  { code: "A-NSM", desc: "Adjetivo, nominativo singular masculino", cat: "Adjetivo" },
  { code: "A-ASF", desc: "Adjetivo, acusativo singular femenino", cat: "Adjetivo" },
  { code: "V-AIA-3S", desc: "Verbo, aoristo indicativo activo, 3ª persona singular", cat: "Verbo" },
  { code: "V-PAI-3S", desc: "Verbo, presente indicativo activo, 3ª persona singular", cat: "Verbo" },
  { code: "V-PAS-3S", desc: "Verbo, presente subjuntivo activo, 3ª persona singular", cat: "Verbo" },
  { code: "V-ADM-3S", desc: "Verbo, aoristo medio subjuntivo, 3ª persona singular", cat: "Verbo" },
  { code: "V-PAP-NSM", desc: "Participio presente activo, nominativo singular masculino", cat: "Verbo" },
  { code: "P-ASM", desc: "Pronombre/partícula, acusativo singular masculino", cat: "Pronombre" },
  { code: "P-NSM", desc: "Pronombre, nominativo singular masculino", cat: "Pronombre" },
  { code: "C", desc: "Conjunción", cat: "Conjunción" },
  { code: "D", desc: "Adverbio / partícula", cat: "Adverbio" },
  { code: "P", desc: "Preposición", cat: "Preposición" },
];

/** morph_code para los tokens griegos de Juan 3:16 (por strong_id). */
const V16_MORPH: Record<string, string> = {
  G3779: "D", G1063: "C", G25: "V-AIA-3S", G3588: "T-NSM", G2316: "N-NSM",
  G2889: "N-ASM", G5620: "C", G5207: "N-ASM", G3439: "A-ASM", G1325: "V-AIA-3S",
  G2443: "C", G3956: "A-NSM", G4100: "V-PAP-NSM", G1519: "P", G846: "P-ASM",
  G3361: "D", G622: "V-ADM-3S", G235: "C", G2192: "V-PAS-3S", G2222: "N-ASF",
  G166: "A-ASF",
};

/** Canon estándar de 66 libros (compartido con import-osis: src/lib/canon.ts). */

/** Manifests de los módulos del seed (claves de la tabla meta, prefijo manifest_). */
const MANIFESTS: Record<string, Record<string, string>> = {
  RV1909: {
    id: "RV1909",
    name: "Reina-Valera 1909",
    type: "bible",
    language: "es",
    version: "0.1.0",
    publisher: "Dominio público",
    license: "Public Domain",
    year: "1909",
    description: "Reina-Valera 1909 — texto de prueba: Juan 3 completo.",
    schemaVersion: "1",
    bookOrder: BOOKLIST.map((b) => b.id).join(","),
  },
  NA28: {
    id: "NA28",
    name: "Novum Testamentum Graece (NA28/SBLGNT demo)",
    type: "bible",
    language: "el",
    version: "0.1.0",
    publisher: "SBLGNT © Society of Biblical Literature",
    license: "SBLGNT license (uso libre)",
    year: "2010",
    description: "Nuevo Testamento Griego — texto de prueba: Juan 3 completo, con Strong y morfología.",
    schemaVersion: "1",
    dependencies: "lexicon",
    strongScheme: "strong",
    bookOrder: BOOKLIST.map((b) => b.id).join(","),
  },
  WTT: {
    id: "WTT",
    name: "Biblia Hebraica Stuttgartensia (WTT)",
    type: "bible",
    language: "he",
    version: "0.1.0",
    publisher: "Deutsche Bibelgesellschaft",
    license: "Copyright — sin texto incluido",
    year: "1997",
    description: "Texto hebreo del AT — módulo vacío (placeholder).",
    schemaVersion: "1",
    dependencies: "lexicon",
    strongScheme: "morphhb",
    bookOrder: BOOKLIST.map((b) => b.id).join(","),
  },
  lexicon: {
    id: "lexicon",
    name: "Diccionario Strong español",
    type: "lexicon",
    language: "el",
    version: "0.1.0",
    publisher: "Alethia Bridge",
    license: "Uso interno",
    year: "2026",
    description: "Léxico griego Strong con definiciones en español y parsing morfológico.",
    schemaVersion: "1",
    strongScheme: "strong",
  },
};

/** Convierte texto en tokens, separando puntuación. */
function tokenize(text: string): Token[] {
  const re = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|[^\p{L}\p{M}\p{N}\s]+/gu;
  const out: Token[] = [];
  for (const m of text.matchAll(re)) {
    const t = m[0];
    out.push({ text: t, isPunct: !/[\p{L}\p{M}\p{N}]/u.test(t) });
  }
  return out;
}

/** Normaliza para lookup de strong: solo quita acentos (preserva ς final). */
function norm(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").toLowerCase();
}

function strongFor(word: string): string | undefined {
  const exact = STRONG_MAP[word];
  if (exact) return exact;
  return STRONG_MAP[norm(word)];
}

/** Agrupa tokens por cláusula (divide en puntuación fuerte: . ; : ? ! —). */
function chunkGroups(tokens: Token[]): { start: number; end: number }[] {
  const groups: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].isPunct && /[.;:?!—]/u.test(tokens[i].text)) {
      if (i > start) groups.push({ start, end: i - 1 });
      groups.push({ start: i, end: i });
      start = i + 1;
    }
  }
  if (start < tokens.length) groups.push({ start, end: tokens.length - 1 });
  return groups;
}

/** Alineación automática por cláusula: junta cláusulas ES y GR por orden. */
function autoAlign(esTokens: Token[], grTokens: Token[]): AlignGroup[] {
  const esChunks = chunkGroups(esTokens);
  const grChunks = chunkGroups(grTokens);
  const groups: AlignGroup[] = [];
  const n = Math.max(esChunks.length, grChunks.length);
  for (let i = 0; i < n; i++) {
    const es: number[] = [];
    const gr: number[] = [];
    if (i < esChunks.length) for (let j = esChunks[i].start; j <= esChunks[i].end; j++) es.push(j);
    if (i < grChunks.length) for (let j = grChunks[i].start; j <= grChunks[i].end; j++) gr.push(j);
    groups.push({ es, gr });
  }
  return groups;
}

/** Construye el mapa token-index → alineacion_id para UN solo idioma. */
function assignIds(groups: AlignGroup[], prefix: string, side: "es" | "gr"): Map<number, string> {
  const map = new Map<number, string>();
  groups.forEach((g, gi) => {
    const id = `${prefix}:g${gi}`;
    for (const i of g[side]) map.set(i, id);
  });
  return map;
}

function insertLexicon(db: Database.Database): void {
  // No borrar `diccionario`: si existe el diccionario Strong real (import-lexicon),
  // las entradas curadas del seed solo se añaden si el strong no está cubierto.
  db.exec("DELETE FROM parsing_gramatical;");
  const insDic = db.prepare(
    `INSERT OR IGNORE INTO diccionario (strong_id, lema, transliteracion, pronunciacion, definicion_corta, definicion_detallada, dominio_semantico, idioma)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insPar = db.prepare(
    `INSERT INTO parsing_gramatical (morph_code, descripcion_espanol, categoria_gramatical) VALUES (?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const e of LEXICON) {
      insDic.run(e.strong, e.lema, e.translit, e.pron ?? null, e.def, e.def_det ?? null, e.dominio ?? null, "GREEK");
    }
    for (const p of PARSING) insPar.run(p.code, p.desc, p.cat);
  });
  tx();
  console.log(`  lexicon.db: ${LEXICON.length} entradas diccionario, ${PARSING.length} parsing`);
}

function seedModule(
  db: Database.Database,
  lexiconDb: Database.Database,
  lang: "es" | "gr",
  groupsByVerse: AlignGroup[][],
): void {
  db.exec("DELETE FROM palabras_interlineal; DELETE FROM versiculos;");
  const insVerse = db.prepare(
    `INSERT INTO versiculos (libro_id, capitulo, versiculo, texto_plano, texto_norm) VALUES (?, ?, ?, ?, ?)`,
  );
  const insWord = db.prepare(
    `INSERT INTO palabras_interlineal (id_versiculo, posicion, texto_superficie, lema, strong_id, morph_code, alineacion_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const getStrong = lexiconDb.prepare(`SELECT lema FROM diccionario WHERE strong_id = ?`);

  const sources = lang === "es" ? ES : GR;
  let totalWords = 0;

  const tx = db.transaction(() => {
    sources.forEach((text, vi) => {
      const tokens = tokenize(text);
      const vNum = vi + 1;
      const idVersiculo = Number(insVerse.run(LIBRO, CAPITULO, vNum, text, normalizeText(text)).lastInsertRowid);
      const groups = groupsByVerse[vi];
      const idMap = assignIds(groups, `${LIBRO}${CAPITULO}:${vNum}`, lang);
      tokens.forEach((t, ti) => {
        let strong: string | null = null;
        let lemma: string | null = null;
        let morph: string | null = null;
        if (lang === "gr" && !t.isPunct) {
          strong = strongFor(t.text) ?? null;
          if (strong) {
            const row = getStrong.get(strong) as { lema: string } | undefined;
            if (row) lemma = row.lema;
            morph = V16_MORPH[strong] ?? null;
          }
        }
        insWord.run(idVersiculo, ti, t.text, lemma, strong, morph, idMap.get(ti) ?? "");
        totalWords++;
      });
    });
  });
  tx();
  console.log(`  ${lang === "es" ? "RV1909" : "NA28"}.db: ${sources.length} versículos, ${totalWords} tokens interlineales`);
}

function main(): void {
  const t0 = performance.now();
  console.log("Seeding Alethia Bridge...");

  const lexicon = initLexiconDb();
  insertLexicon(lexicon);

  const esTokens = ES.map(tokenize);
  const grTokens = GR.map(tokenize);

  const groupsByVerse: AlignGroup[][] = ES.map((_, vi) => {
    if (vi === 15) return V16_ALIGN; // Juan 3:16 → alineación palabra a palabra
    return autoAlign(esTokens[vi], grTokens[vi]);
  });

  // Manifest + canon de cada módulo (meta/libros)
  for (const id of ["RV1909", "NA28", "WTT", "lexicon"]) {
    const db = getModuleDb(id);
    initModuleMeta(db);
    writeManifestMeta(db, MANIFESTS[id]);
    if (id !== "lexicon") writeBooks(db, BOOKLIST.map((b, i) => ({ ...b, orden: i + 1 })));
  }

  seedModule(initModuleDb("RV1909"), lexicon, "es", groupsByVerse);
  seedModule(initModuleDb("NA28"), lexicon, "gr", groupsByVerse);

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`Seed completo en ${elapsed}ms`);
}

main();
