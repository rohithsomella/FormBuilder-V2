using System.Security.Cryptography;

namespace FormBuilderAppService.Services
{
    /// <summary>
    /// Produces the one-time password handed to a newly created account.
    ///
    /// Two properties matter here:
    ///  - It is drawn from <see cref="RandomNumberGenerator"/>, not Random. A password
    ///    generated from a predictable sequence is a password an attacker can guess.
    ///  - It always contains an uppercase letter, a lowercase letter, a digit and a
    ///    symbol, so it satisfies Identity's default password policy on the first try
    ///    rather than failing validation at random.
    ///
    /// Easily-confused characters (O/0, l/1/I) are left out because a human reads this
    /// value off a screen and types it somewhere else.
    /// </summary>
    public static class TemporaryPasswordGenerator
    {
        private const string Uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        private const string Lowercase = "abcdefghijkmnopqrstuvwxyz";
        private const string Digits = "23456789";
        private const string Symbols = "!@#$%*?-_";

        private const int Length = 14;

        /// <summary>
        /// How many characters of each class are placed before the random fill.
        /// </summary>
        private const int GuaranteedPerClass = 2;

        public static string Generate()
        {
            var characters = new List<char>(Length);

            for (var i = 0; i < GuaranteedPerClass; i++)
            {
                characters.Add(Pick(Uppercase));
                characters.Add(Pick(Lowercase));
                characters.Add(Pick(Digits));
                characters.Add(Pick(Symbols));
            }

            var everything = Uppercase + Lowercase + Digits + Symbols;

            while (characters.Count < Length)
            {
                characters.Add(Pick(everything));
            }

            // Without this the first eight characters would follow a fixed
            // upper-lower-digit-symbol pattern, which is a large hint to a guesser.
            Shuffle(characters);

            return new string(characters.ToArray());
        }

        private static char Pick(string alphabet) =>
            alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];

        /// <summary>
        /// Fisher-Yates, using the same cryptographic source as the character picks.
        /// </summary>
        private static void Shuffle(IList<char> characters)
        {
            for (var i = characters.Count - 1; i > 0; i--)
            {
                var j = RandomNumberGenerator.GetInt32(i + 1);
                (characters[i], characters[j]) = (characters[j], characters[i]);
            }
        }
    }
}
